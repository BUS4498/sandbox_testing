import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { MemoryConflictError, OperationalMemoryStore } from "../src/persistence/operational-memory-store.js";
import { resolveRuntimePaths } from "../src/persistence/runtime-paths.js";

async function withTemporaryDirectory(run) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "internship-memory-test-"));
  try {
    await run(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test("runtime paths keep private operational data under the selected local root", () => {
  const paths = resolveRuntimePaths({ rootDir: path.join(os.tmpdir(), "internship-agent-data") });
  assert.equal(path.basename(paths.spreadsheet), "internship_pipeline.xlsx");
  assert.equal(path.dirname(paths.spreadsheet), paths.root);
  assert.equal(path.dirname(paths.memory), paths.root);
  assert.equal(path.dirname(paths.settings), paths.root);
});

test("memory appends structured history and supports idempotency lookup", async () => {
  await withTemporaryDirectory(async (directory) => {
    const store = await new OperationalMemoryStore({ rootDir: directory }).initialize();
    const action = await store.appendAction({
      runId: "run-001",
      opportunityId: "opp-001",
      actionType: "SPREADSHEET_ROW_ADDED",
      idempotencyKey: "spreadsheet:add:opp-001:v1",
      outcome: "SUCCESS",
    });
    await store.appendObservation({
      runId: "run-001",
      opportunityId: "opp-001",
      observationType: "SPREADSHEET_UPDATE_CONFIRMED",
      evidence: { sourceUrl: "https://example.edu/jobs/001" },
    });

    assert.equal(action.memoryType, "ACTION");
    assert.equal(await store.hasSuccessfulAction("spreadsheet:add:opp-001:v1"), true);
    assert.equal((await store.list("observation", { opportunityId: "opp-001" })).length, 1);

    const fileText = await readFile(path.join(directory, "actions.jsonl"), "utf8");
    assert.match(fileText, /SPREADSHEET_ROW_ADDED/);
  });
});

test("state updates are versioned and reject stale writes", async () => {
  await withTemporaryDirectory(async (directory) => {
    const store = await new OperationalMemoryStore({ rootDir: directory }).initialize();
    const first = await store.upsertOpportunityState(
      "opp-002",
      { postingStatus: "ACTIVE", recommendation: "MONITOR" },
      { expectedVersion: 0 },
    );
    assert.equal(first.recordVersion, 1);

    await assert.rejects(
      store.upsertOpportunityState("opp-002", { recommendation: "PRIORITIZE" }, { expectedVersion: 0 }),
      MemoryConflictError,
    );

    const second = await store.upsertOpportunityState(
      "opp-002",
      { recommendation: "PRIORITIZE" },
      { expectedVersion: 1 },
    );
    assert.equal(second.recordVersion, 2);
    assert.equal(second.postingStatus, "ACTIVE");
  });
});

test("memory rejects secrets and unnecessary full-page content", async () => {
  await withTemporaryDirectory(async (directory) => {
    const store = await new OperationalMemoryStore({ rootDir: directory }).initialize();
    await assert.rejects(store.appendAction({ apiKey: "not-allowed" }), /must not store credentials/);
    await assert.rejects(store.appendObservation({ rawHtml: "<html></html>" }), /not full web pages/);
  });
});

test("runtime thread metadata is kept in operational state", async () => {
  await withTemporaryDirectory(async (directory) => {
    const store = await new OperationalMemoryStore({ rootDir: directory }).initialize();
    await store.updateRuntimeState({ threadId: "thr_synthetic_001" });
    const state = await store.getState();
    assert.equal(state.runtime.threadId, "thr_synthetic_001");
  });
});
