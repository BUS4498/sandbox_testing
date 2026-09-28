import assert from "node:assert/strict";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { RunNowManager } from "../src/controller/run-now-manager.js";
import { StudentEmailNotifier } from "../src/notifications/student-email-notifier.js";
import { OperationalMemoryStore } from "../src/persistence/operational-memory-store.js";
import { LocalSpreadsheetTracker } from "../src/persistence/spreadsheet-tracker.js";
import { WorkflowActionCoordinator } from "../src/workflow/workflow-action-coordinator.js";

const REPOSITORY_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

class StructuredResultApiClient {
  constructor(resultFactory) {
    this.resultFactory = resultFactory;
    this.calls = [];
  }
  async readiness({ checkedAt } = {}) {
    return { status: "READY", label: "OpenAI API ready", detail: "Configured locally.", authentication: "API key configured", checkedAt };
  }
  async runWorkflow({ input, allowWebSearch, onEvent }) {
    this.calls.push({ input, allowWebSearch });
    const result = this.resultFactory(this.calls.length);
    const searchesPerformed = allowWebSearch ? result.runSummary.searchesPerformed : 0;
    onEvent?.({ type: "response.completed", searchesPerformed, sourceCount: allowWebSearch ? 1 : 0 });
    return { outputText: JSON.stringify(result), responseId: `resp_integration_${this.calls.length}`, searchesPerformed, sources: [] };
  }
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
  const client = new StructuredResultApiClient(resultFactory);
  const manager = new RunNowManager({
    workspaceRoot: REPOSITORY_ROOT,
    memoryStore,
    spreadsheetTracker,
    workflowCoordinator: coordinator,
    clientFactory: () => client,
    clock: () => new Date("2026-08-25T12:00:00.000Z"),
    studentProfileStore: readyDemoStore(),
  });
  try {
    await run({ manager, coordinator, client, memoryStore, spreadsheetTracker, directory });
  } finally {
    await manager.close();
    await rm(directory, { recursive: true, force: true });
  }
}

function readyDemoStore() {
  return {
    async snapshot() {
      return { readyForCollection: true, mode: "DEMO", activeLabel: "Synthetic demonstration setup", missingItems: [] };
    },
    async activeStudentContext() {
      return {
        mode: "DEMO",
        sourceType: "SYNTHETIC_DEMONSTRATION",
        sourceLabel: "Explicitly selected synthetic demonstration setup",
        confirmedAt: null,
        resume: "Synthetic Information Systems student with SQL and Power BI evidence.",
        preferences: "AI Business Analyst and Business Systems Analyst internships in California.",
        constraints: "Available Summer 2027 for paid hybrid or remote work.",
      };
    },
  };
}

test("integrates API structured output through spreadsheet, notification preview, verification, memory, and run summary", async () => {
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
    assert.match(client.calls[0].input, /job-fit-assessment/);
    assert.equal(client.calls[0].allowWebSearch, true);
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
