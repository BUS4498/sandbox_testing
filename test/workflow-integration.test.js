import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { RunNowManager } from "../src/controller/run-now-manager.js";
import { StudentEmailNotifier } from "../src/notifications/student-email-notifier.js";
import { OperationalMemoryStore } from "../src/persistence/operational-memory-store.js";
import { LocalSpreadsheetTracker } from "../src/persistence/spreadsheet-tracker.js";
import { WorkflowActionCoordinator } from "../src/workflow/workflow-action-coordinator.js";

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

class StructuredResultCodexClient extends EventEmitter {
  constructor(resultFactory) {
    super();
    this.resultFactory = resultFactory;
    this.turnNumber = 0;
    this.calls = [];
  }

  async initialize() { this.calls.push("initialize"); }
  async readAccount() { return { account: { type: "chatgpt" }, requiresOpenaiAuth: true }; }
  async startThread() { return { thread: { id: "thr_integration" } }; }
  async resumeThread(threadId) { return { thread: { id: threadId } }; }

  async startTurn(threadId, input) {
    this.turnNumber += 1;
    const turnId = `turn_integration_${this.turnNumber}`;
    this.calls.push({ threadId, input });
    const result = this.resultFactory(this.turnNumber);
    queueMicrotask(() => {
      this.emit("notification", {
        method: "turn/started",
        params: { turn: { id: turnId, status: "inProgress" } },
      });
      this.emit("notification", {
        method: "item/started",
        params: {
          turnId,
          item: { id: `web_${this.turnNumber}`, type: "webSearch", action: { type: "search", queries: ["IS internships"] } },
        },
      });
      this.emit("notification", {
        method: "item/completed",
        params: { turnId, item: { id: `message_${this.turnNumber}`, type: "agentMessage", phase: "final_answer", text: JSON.stringify(result) } },
      });
      this.emit("notification", {
        method: "turn/completed",
        params: { turn: { id: turnId, status: "completed" } },
      });
    });
    return { turn: { id: turnId } };
  }

  respondResult() {}
  async close() {}
}

function workflowResult({ disposition = "NEW", deadline = "2026-10-15", existingOpportunityId = null } = {}) {
  return {
    schemaVersion: 1,
    runSummary: {
      searchesPerformed: 1,
      candidatesDiscovered: 4,
      duplicatesOrInvalid: 1,
      candidatesRanked: 3,
      selectionShortfallReason: "Only one sufficiently relevant, non-duplicate opportunity qualified in this synthetic test run.",
    },
    selectedOpportunities: [
      {
        updateDisposition: disposition,
        existingOpportunityId,
        opportunity: {
          opportunityId: disposition === "NEW" ? "opp-integration-001" : "",
          company: "Northstar Retail Analytics",
          roleTitle: "Information Systems Intern",
          location: "San Luis Obispo, CA",
          workArrangement: "Hybrid",
          internshipPeriod: "Summer 2027",
          deadline,
          source: "Employer career page",
          postingUrl: "https://careers.example.edu/jobs/opp-integration-001",
          employerPostingId: "NS-001",
          postingStatus: "ACTIVE",
          dateDiscovered: "2026-08-25",
          lastVerified: "2026-08-25",
        },
        fitAssessment: "STRONG",
        agentDecision: "PRIORITIZE",
        decisionRationale: "Verified coursework and project evidence align with the stated requirements.",
        selectionEvidence: ["Required SQL coursework is supported by verified context."],
        fitEvidence: {
          requiredMatches: ["SQL coursework"],
          preferredMatches: ["Power BI project"],
          gaps: [],
          unknowns: ["Exact weekly schedule"],
          preferenceAlignment: ["Hybrid business-analysis work"],
        },
        whatChanged: disposition === "NEW" ? ["New verified opportunity"] : ["deadline"],
        nextAction: "Review the posting and prepare application materials.",
        nextActionDate: "2026-09-01",
        unresolvedIssue: "",
        attentionRequired: true,
      },
    ],
    unresolvedIssues: [],
  };
}

async function withIntegratedWorkflow(run, resultFactory = () => workflowResult()) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "internship-workflow-integration-"));
  const memoryStore = await new OperationalMemoryStore({ rootDir: path.join(directory, "memory") }).initialize();
  const spreadsheetTracker = new LocalSpreadsheetTracker({
    filePath: path.join(directory, "internship_pipeline.xlsx"),
    artifactToolModulePath: ARTIFACT_TOOL_MODULE,
    clock: () => new Date("2026-08-25T12:00:00.000Z"),
  });
  const notifier = new StudentEmailNotifier({
    recipient: "student@example.edu",
    memoryStore,
    outboxDir: path.join(directory, "outbox"),
    mode: "DRY_RUN",
    clock: () => new Date("2026-08-25T12:00:00.000Z"),
  });
  const coordinator = new WorkflowActionCoordinator({
    spreadsheetTracker,
    memoryStore,
    notifier,
    clock: () => new Date("2026-08-25T12:00:00.000Z"),
  });
  const client = new StructuredResultCodexClient(resultFactory);
  const manager = new RunNowManager({
    workspaceRoot: directory,
    memoryStore,
    workflowCoordinator: coordinator,
    clientFactory: () => client,
    clock: () => new Date("2026-08-25T12:00:00.000Z"),
  });
  try {
    await run({ manager, coordinator, client, memoryStore, spreadsheetTracker, directory });
  } finally {
    await manager.close();
    await rm(directory, { recursive: true, force: true });
  }
}

test("integrates Codex structured output through spreadsheet, notification, verification, memory, and run summary", async () => {
  await withIntegratedWorkflow(async ({ manager, memoryStore, spreadsheetTracker, directory, client }) => {
    const stageEvents = [];
    manager.on("event", (event) => {
      if (event.type === "run.stage") stageEvents.push(event.stage);
    });
    const started = manager.startRun();
    const completed = await manager.waitForRun(started.runId);

    assert.equal(completed.outcome, "SUCCESS");
    assert.equal(completed.newOpportunitiesAdded, 1);
    assert.equal(completed.notificationsSent, 0);
    assert.equal(completed.notificationPreviews, 1);
    assert.equal(completed.updatesSelected, 1);
    assert.equal((await spreadsheetTracker.readRecords()).length, 1);
    assert.equal((await readdir(path.join(directory, "outbox"))).length, 1);
    assert.equal((await memoryStore.list("decision")).length, 1);
    assert.equal((await memoryStore.list("evaluation")).some((entry) => entry.outcome === "SUCCESS"), true);
    assert.deepEqual(stageEvents.slice(-4), ["UPDATING_COLLECTION", "SENDING_NOTIFICATIONS", "VERIFYING", "REMEMBERING"]);
    assert.equal(client.calls[1].input[1].type, "skill");
    assert.equal(client.calls[1].input[1].name, "job-fit-assessment");
  });
});

test("an unchanged rediscovery creates neither a second row nor a second notification", async () => {
  await withIntegratedWorkflow(async ({ coordinator, spreadsheetTracker, directory }) => {
    const first = await coordinator.process({ runId: "run-one", resultText: JSON.stringify(workflowResult()), observedSearches: 1 });
    const second = await coordinator.process({ runId: "run-two", resultText: JSON.stringify(workflowResult()), observedSearches: 1 });
    assert.equal(first.summary.newOpportunitiesAdded, 1);
    assert.equal(second.summary.newOpportunitiesAdded, 0);
    assert.equal(second.selectedOpportunities[0].collectionOutcome, "DUPLICATE_IGNORED");
    assert.equal((await spreadsheetTracker.readRecords()).length, 1);
    assert.equal((await readdir(path.join(directory, "outbox"))).length, 1);
  });
});

test("a material deadline change updates the existing row and creates one update preview", async () => {
  await withIntegratedWorkflow(async ({ coordinator, spreadsheetTracker, directory }) => {
    await coordinator.process({ runId: "run-one", resultText: JSON.stringify(workflowResult()), observedSearches: 1 });
    const changed = workflowResult({
      disposition: "MATERIALLY_CHANGED",
      deadline: "2026-09-30",
      existingOpportunityId: "opp-integration-001",
    });
    const result = await coordinator.process({ runId: "run-two", resultText: JSON.stringify(changed), observedSearches: 1 });
    const [record] = await spreadsheetTracker.readRecords();
    assert.equal(result.summary.existingOpportunitiesUpdated, 1);
    assert.equal(record.deadline, "2026-09-30");
    assert.equal(record.recordVersion, 2);
    assert.equal((await readdir(path.join(directory, "outbox"))).length, 2);
  });
});

test("a notification-helper exception becomes a recorded unresolved issue without undoing the spreadsheet update", async () => {
  await withIntegratedWorkflow(async ({ coordinator, spreadsheetTracker, memoryStore }) => {
    coordinator.notifier = {
      async notifyMaterialUpdate() {
        throw new Error("synthetic provider failure");
      },
    };

    const result = await coordinator.process({
      runId: "run-notification-failure",
      resultText: JSON.stringify(workflowResult()),
      observedSearches: 1,
    });

    assert.equal(result.outcome, "PARTIAL SUCCESS");
    assert.equal(result.summary.newOpportunitiesAdded, 1);
    assert.equal(result.summary.notificationsSent, 0);
    assert.equal(result.selectedOpportunities[0].notificationStatus, "FAILED");
    assert.equal((await spreadsheetTracker.readRecords()).length, 1);
    assert.equal(
      (await memoryStore.list("action")).some(
        (entry) => entry.actionType === "STUDENT_UPDATE_NOTIFICATION" && entry.outcome === "FAILED",
      ),
      true,
    );
  });
});
