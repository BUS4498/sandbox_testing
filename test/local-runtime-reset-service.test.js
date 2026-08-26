import assert from "node:assert/strict";
import { access, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { LocalApplicationMaterialStore } from "../src/persistence/application-material-store.js";
import { LocalRuntimeResetService } from "../src/persistence/local-runtime-reset-service.js";
import { OperationalMemoryStore } from "../src/persistence/operational-memory-store.js";
import { resolveRuntimePaths } from "../src/persistence/runtime-paths.js";
import { LocalSpreadsheetTracker } from "../src/persistence/spreadsheet-tracker.js";

const ARTIFACT_TOOL_MODULE = path.join(
  os.homedir(),
  ".cache",
  "codex-runtimes",
  "codex-primary-runtime",
  "dependencies",
  "node",
  "node_modules",
  "@oai",
  "artifact-tool",
);

test("archives active collection data and initializes a fresh collection while preserving settings and schedule", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "internship-reset-test-"));
  const runtimePaths = resolveRuntimePaths({ rootDir: directory });
  const spreadsheetTracker = await new LocalSpreadsheetTracker({
    filePath: runtimePaths.spreadsheet,
    artifactToolModulePath: ARTIFACT_TOOL_MODULE,
    clock: () => new Date("2026-08-25T12:00:00.000Z"),
    idFactory: () => "reset-sheet-id",
  }).initialize();
  const memoryStore = await new OperationalMemoryStore({
    rootDir: runtimePaths.memory,
    clock: () => new Date("2026-08-25T12:00:00.000Z"),
    idFactory: () => "reset-memory-id",
  }).initialize();
  const applicationMaterialStore = await new LocalApplicationMaterialStore({
    rootDir: runtimePaths.applicationMaterials,
    clock: () => new Date("2026-08-25T12:00:00.000Z"),
    idFactory: () => "reset-material-id",
  }).initialize();
  const runManager = {
    resetCalls: 0,
    snapshot() { return null; },
    resetForFreshCollection() { this.resetCalls += 1; },
  };

  try {
    await spreadsheetTracker.addOpportunity({
      opportunityId: "opp-reset-001",
      company: "Synthetic Systems",
      roleTitle: "AI Business Analyst Intern",
      postingUrl: "https://example.edu/jobs/opp-reset-001",
      postingStatus: "ACTIVE",
    });
    await memoryStore.appendObservation({ runId: "run-reset-001", opportunityId: "opp-reset-001", observationType: "OPPORTUNITY_DISCOVERED" });
    await memoryStore.updateRuntimeState({
      threadId: "thread-before-reset",
      schedule: { status: "CONFIGURED", schedule: "9:00 AM daily" },
    });
    await applicationMaterialStore.saveTemplate({
      opportunityId: "opp-reset-001",
      company: "Synthetic Systems",
      roleTitle: "AI Business Analyst Intern",
      type: "COVER_LETTER_OUTLINE",
      title: "Cover-letter outline",
      markdown: "## Evidence to review\n\n- Confirm the verified SQL project.",
    });
    await mkdir(runtimePaths.notificationOutbox, { recursive: true });
    await writeFile(path.join(runtimePaths.notificationOutbox, "preview.json"), "{}\n", "utf8");
    await writeFile(runtimePaths.settings, '{"notificationEmail":"student@example.edu"}\n', "utf8");

    const service = new LocalRuntimeResetService({
      runtimePaths,
      spreadsheetTracker,
      memoryStore,
      applicationMaterialStore,
      runManager,
      clock: () => new Date("2026-08-25T13:00:00.000Z"),
      idFactory: () => "reset-archive-id",
    });
    const result = await service.reset({ confirmation: "RESET" });

    assert.equal(result.opportunitiesCleared, 1);
    assert.equal((await spreadsheetTracker.readRecords()).length, 0);
    assert.equal((await applicationMaterialStore.listMaterials()).length, 0);
    assert.equal(runManager.resetCalls, 1);
    const state = await memoryStore.getState();
    assert.deepEqual(state.opportunities, {});
    assert.equal(state.runtime.threadId, undefined);
    assert.equal(state.runtime.schedule.status, "CONFIGURED");
    assert.match(await readFile(runtimePaths.settings, "utf8"), /student@example\.edu/);
    await access(path.join(result.archivePath, "internship_pipeline.xlsx"));
    await access(path.join(result.archivePath, "memory"));
    await access(path.join(result.archivePath, "application-materials"));
    await access(path.join(result.archivePath, "notification-outbox"));
    assert.equal(JSON.parse(await readFile(runtimePaths.resetSummary, "utf8")).archivePath, result.archivePath);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("rejects reset without exact confirmation or while a workflow is active", async () => {
  const service = new LocalRuntimeResetService({
    runtimePaths: {},
    spreadsheetTracker: { async readRecords() { return []; } },
    memoryStore: { async getState() { return { runtime: {} }; } },
    applicationMaterialStore: {},
    runManager: { snapshot() { return { active: true }; } },
  });
  await assert.rejects(service.reset({ confirmation: "reset" }), /Enter RESET/);
  await assert.rejects(service.reset({ confirmation: "RESET" }), /active workflow/);
});
