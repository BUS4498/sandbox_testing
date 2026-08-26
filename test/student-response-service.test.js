import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { OperationalMemoryStore } from "../src/persistence/operational-memory-store.js";
import { LocalSpreadsheetTracker } from "../src/persistence/spreadsheet-tracker.js";
import { StudentResponseService } from "../src/workflow/student-response-service.js";

const ARTIFACT_TOOL_MODULE = path.join(os.homedir(), ".cache", "codex-runtimes", "codex-primary-runtime", "dependencies", "node", "node_modules", "@oai", "artifact-tool");

test("records student clarification for an immediate targeted update", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "internship-response-test-"));
  const memoryStore = await new OperationalMemoryStore({ rootDir: path.join(directory, "memory"), clock: () => new Date("2026-08-25T12:00:00.000Z") }).initialize();
  const tracker = await new LocalSpreadsheetTracker({ filePath: path.join(directory, "pipeline.xlsx"), artifactToolModulePath: ARTIFACT_TOOL_MODULE, clock: () => new Date("2026-08-25T12:00:00.000Z") }).initialize();
  await tracker.addOpportunity({ opportunityId: "opp-response-001", company: "Northstar", roleTitle: "IS Intern", postingUrl: "https://example.edu/jobs/1", postingStatus: "ACTIVE", studentNotes: "Prior student note" });
  const service = new StudentResponseService({ spreadsheetTracker: tracker, memoryStore, clock: () => new Date("2026-08-25T12:00:00.000Z"), idFactory: () => "response-001" });
  try {
    const result = await service.submit({ opportunityId: "opp-response-001", type: "PROVIDE_INFORMATION", text: "I can work on Tuesdays and Thursdays." });
    assert.equal(result.status, "READY_FOR_UPDATE");
    assert.match(result.nextStep, /now run a targeted update/);
    const record = await tracker.getOpportunity("opp-response-001");
    assert.match(record.studentNotes, /Prior student note/);
    assert.match(record.studentNotes, /Tuesdays and Thursdays/);
    const state = await memoryStore.getState();
    assert.equal(state.opportunities["opp-response-001"].studentInput.responseId, "response-001");
    assert.equal(state.opportunities["opp-response-001"].studentInput.status, "READY_FOR_UPDATE");
    const started = await service.markUpdateStarted({ opportunityId: "opp-response-001", responseId: "response-001", runId: "run-update-001" });
    assert.equal(started.status, "UPDATE_IN_PROGRESS");
    assert.match(started.nextStep, /No separate Collect run/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("application preparation requests require at least one safe template type", async () => {
  const service = new StudentResponseService({
    spreadsheetTracker: { async getOpportunity() { return { opportunityId: "opp-001", recordVersion: 1, studentNotes: "" }; } },
    memoryStore: {},
  });
  await assert.rejects(service.submit({ opportunityId: "opp-001", type: "REQUEST_APPLICATION_MATERIALS", templateTypes: [] }), /at least one/);
});
