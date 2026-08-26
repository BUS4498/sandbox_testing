import { randomUUID } from "node:crypto";
import { access, cp, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

export class LocalRuntimeResetService {
  #queue = Promise.resolve();

  constructor({
    runtimePaths,
    spreadsheetTracker,
    memoryStore,
    applicationMaterialStore,
    runManager,
    clock = () => new Date(),
    idFactory = randomUUID,
  }) {
    if (!runtimePaths || !spreadsheetTracker || !memoryStore || !applicationMaterialStore || !runManager) {
      throw new TypeError("LocalRuntimeResetService requires runtime paths and active local stores.");
    }
    this.runtimePaths = runtimePaths;
    this.spreadsheetTracker = spreadsheetTracker;
    this.memoryStore = memoryStore;
    this.applicationMaterialStore = applicationMaterialStore;
    this.runManager = runManager;
    this.clock = clock;
    this.idFactory = idFactory;
  }

  reset({ confirmation } = {}) {
    return this.#enqueue(async () => {
      if (String(confirmation ?? "").trim() !== "RESET") {
        throw new TypeError("Enter RESET to confirm the fresh-start archive and reset.");
      }
      if (this.runManager.snapshot()?.active) {
        const error = new Error("Wait for the active workflow to finish before resetting the collection.");
        error.code = "RUN_ACTIVE";
        throw error;
      }

      const priorRecords = await this.spreadsheetTracker.readRecords();
      const priorState = await this.memoryStore.getState();
      const preservedSchedule = priorState.runtime?.schedule ?? null;
      const timestamp = this.clock().toISOString();
      const archiveName = `${timestamp.replace(/[:.]/g, "-")}-${safeSegment(this.idFactory())}`;
      const archivePath = path.join(this.runtimePaths.resetArchives, archiveName);
      await mkdir(archivePath, { recursive: true });

      const sources = [
        [this.runtimePaths.spreadsheet, "internship_pipeline.xlsx"],
        [this.runtimePaths.memory, "memory"],
        [this.runtimePaths.applicationMaterials, "application-materials"],
        [this.runtimePaths.notificationOutbox, "notification-outbox"],
      ];
      for (const [source, name] of sources) {
        if (await exists(source)) await cp(source, path.join(archivePath, name), { recursive: true, errorOnExist: true });
      }

      await rm(this.runtimePaths.spreadsheet, { force: true });
      await rm(this.runtimePaths.memory, { recursive: true, force: true });
      await rm(this.runtimePaths.applicationMaterials, { recursive: true, force: true });
      await rm(this.runtimePaths.notificationOutbox, { recursive: true, force: true });

      await this.spreadsheetTracker.initialize();
      await this.memoryStore.initialize();
      if (preservedSchedule) await this.memoryStore.updateRuntimeState({ schedule: preservedSchedule });
      await this.applicationMaterialStore.initialize();
      this.runManager.resetForFreshCollection();

      const result = {
        resetAt: timestamp,
        opportunitiesCleared: priorRecords.length,
        archivePath,
        spreadsheetPath: this.runtimePaths.spreadsheet,
        preserved: [
          "student context",
          "notification recipient",
          "Codex and Outlook authentication",
          "Codex-managed automation configuration",
        ],
      };
      await writeFile(this.runtimePaths.resetSummary, `${JSON.stringify(result, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
      return result;
    });
  }

  #enqueue(operation) {
    const queued = this.#queue.then(operation, operation);
    this.#queue = queued.catch(() => undefined);
    return queued;
  }
}

async function exists(targetPath) {
  try { await access(targetPath); return true; } catch { return false; }
}

function safeSegment(value) {
  const segment = String(value).replace(/[^A-Za-z0-9._-]/g, "-").slice(0, 80);
  return segment || "reset";
}
