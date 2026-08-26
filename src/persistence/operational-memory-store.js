import { randomUUID } from "node:crypto";
import { mkdir, open, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

const MEMORY_FILES = Object.freeze({
  decision: "decisions.jsonl",
  action: "actions.jsonl",
  observation: "observations.jsonl",
  evaluation: "evaluations.jsonl",
  run: "runs.jsonl",
});

const FORBIDDEN_KEY = /(password|api[_-]?key|access[_-]?token|refresh[_-]?token|secret|credential)/i;
const RAW_PAGE_KEY = /(raw[_-]?(html|page)|full[_-]?page[_-]?(content|html)|page[_-]?source)/i;

export class MemoryConflictError extends Error {
  constructor(message) {
    super(message);
    this.name = "MemoryConflictError";
  }
}

export class OperationalMemoryStore {
  #writeQueue = Promise.resolve();

  constructor({ rootDir, clock = () => new Date(), idFactory = randomUUID }) {
    if (!rootDir) throw new TypeError("OperationalMemoryStore requires rootDir.");
    this.rootDir = path.resolve(rootDir);
    this.statePath = path.join(this.rootDir, "state.json");
    this.clock = clock;
    this.idFactory = idFactory;
  }

  async initialize() {
    await mkdir(this.rootDir, { recursive: true });
    try {
      await readFile(this.statePath, "utf8");
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      await this.#writeState(createInitialState(this.#now()));
    }
    return this;
  }

  appendDecision(payload) {
    return this.append("decision", payload);
  }

  appendAction(payload) {
    return this.append("action", payload);
  }

  appendObservation(payload) {
    return this.append("observation", payload);
  }

  appendEvaluation(payload) {
    return this.append("evaluation", payload);
  }

  recordRunSummary(payload) {
    return this.append("run", payload);
  }

  async append(type, payload) {
    assertMemoryType(type);
    assertSafeMemoryPayload(payload);

    const entry = Object.freeze({
      memoryId: this.idFactory(),
      memoryType: type.toUpperCase(),
      timestamp: this.#now(),
      ...structuredClone(payload),
    });

    return this.#enqueue(async () => {
      await mkdir(this.rootDir, { recursive: true });
      const filePath = path.join(this.rootDir, MEMORY_FILES[type]);
      const handle = await open(filePath, "a");
      try {
        await handle.writeFile(`${JSON.stringify(entry)}\n`, "utf8");
        await handle.sync();
      } finally {
        await handle.close();
      }
      return entry;
    });
  }

  async list(type, { opportunityId, runId, limit } = {}) {
    assertMemoryType(type);
    const filePath = path.join(this.rootDir, MEMORY_FILES[type]);
    let text;
    try {
      text = await readFile(filePath, "utf8");
    } catch (error) {
      if (error.code === "ENOENT") return [];
      throw error;
    }

    const entries = text
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line, index) => {
        try {
          return JSON.parse(line);
        } catch (error) {
          throw new Error(`${MEMORY_FILES[type]} contains invalid JSON at line ${index + 1}.`, { cause: error });
        }
      })
      .filter((entry) => !opportunityId || entry.opportunityId === opportunityId)
      .filter((entry) => !runId || entry.runId === runId);

    return Number.isInteger(limit) && limit >= 0 ? entries.slice(-limit) : entries;
  }

  async hasSuccessfulAction(idempotencyKey) {
    if (!idempotencyKey) return false;
    const actions = await this.list("action");
    return actions.some(
      (entry) =>
        entry.idempotencyKey === idempotencyKey &&
        ["SUCCESS", "COMPLETED", "SENT"].includes(String(entry.outcome ?? entry.status).toUpperCase()),
    );
  }

  async getState() {
    try {
      return JSON.parse(await readFile(this.statePath, "utf8"));
    } catch (error) {
      if (error.code === "ENOENT") {
        await this.initialize();
        return JSON.parse(await readFile(this.statePath, "utf8"));
      }
      if (error instanceof SyntaxError) {
        throw new Error("Operational state is corrupted and could not be parsed.", { cause: error });
      }
      throw error;
    }
  }

  async upsertOpportunityState(opportunityId, changes, { expectedVersion } = {}) {
    if (!opportunityId) throw new TypeError("opportunityId is required.");
    assertSafeMemoryPayload(changes);

    return this.#enqueue(async () => {
      const state = await this.getState();
      const prior = state.opportunities[opportunityId] ?? null;
      const actualVersion = prior?.recordVersion ?? 0;

      if (expectedVersion !== undefined && expectedVersion !== actualVersion) {
        throw new MemoryConflictError(
          `Opportunity ${opportunityId} expected version ${expectedVersion}, but current version is ${actualVersion}.`,
        );
      }

      const now = this.#now();
      const next = {
        ...(prior ?? {}),
        ...structuredClone(changes),
        opportunityId,
        recordVersion: actualVersion + 1,
        updatedAt: now,
      };
      state.opportunities[opportunityId] = next;
      state.version += 1;
      state.updatedAt = now;
      await this.#writeState(state);
      return structuredClone(next);
    });
  }

  async setCurrentRun(currentRun, { expectedStateVersion } = {}) {
    assertSafeMemoryPayload(currentRun ?? {});
    return this.#enqueue(async () => {
      const state = await this.getState();
      if (expectedStateVersion !== undefined && expectedStateVersion !== state.version) {
        throw new MemoryConflictError(
          `State expected version ${expectedStateVersion}, but current version is ${state.version}.`,
        );
      }
      state.currentRun = currentRun ? structuredClone(currentRun) : null;
      state.version += 1;
      state.updatedAt = this.#now();
      await this.#writeState(state);
      return structuredClone(state);
    });
  }

  async updateRuntimeState(changes, { expectedStateVersion } = {}) {
    assertSafeMemoryPayload(changes ?? {});
    return this.#enqueue(async () => {
      const state = await this.getState();
      if (expectedStateVersion !== undefined && expectedStateVersion !== state.version) {
        throw new MemoryConflictError(
          `State expected version ${expectedStateVersion}, but current version is ${state.version}.`,
        );
      }
      state.runtime = { ...(state.runtime ?? {}), ...structuredClone(changes) };
      state.version += 1;
      state.updatedAt = this.#now();
      await this.#writeState(state);
      return structuredClone(state);
    });
  }

  #now() {
    return this.clock().toISOString();
  }

  #enqueue(operation) {
    const queued = this.#writeQueue.then(operation, operation);
    this.#writeQueue = queued.catch(() => undefined);
    return queued;
  }

  async #writeState(state) {
    await mkdir(this.rootDir, { recursive: true });
    const temporaryPath = `${this.statePath}.${this.idFactory()}.tmp`;
    await writeFile(temporaryPath, `${JSON.stringify(state, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
    await rename(temporaryPath, this.statePath);
  }
}

function createInitialState(timestamp) {
  return {
    schemaVersion: 1,
    version: 0,
    updatedAt: timestamp,
    opportunities: {},
    currentRun: null,
    runtime: {},
  };
}

function assertMemoryType(type) {
  if (!(type in MEMORY_FILES)) {
    throw new TypeError(`Unknown memory type: ${type}.`);
  }
}

function assertSafeMemoryPayload(value, trail = "payload") {
  if (value === null || value === undefined) return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertSafeMemoryPayload(item, `${trail}[${index}]`));
    return;
  }
  if (typeof value !== "object") return;

  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_KEY.test(key)) {
      throw new TypeError(`Operational memory must not store credentials (${trail}.${key}).`);
    }
    if (RAW_PAGE_KEY.test(key)) {
      throw new TypeError(`Operational memory stores structured evidence, not full web pages (${trail}.${key}).`);
    }
    assertSafeMemoryPayload(child, `${trail}.${key}`);
  }
}
