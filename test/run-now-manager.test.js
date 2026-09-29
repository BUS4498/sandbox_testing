import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { RunAlreadyActiveError, RunNowManager } from "../src/controller/run-now-manager.js";
import { OperationalMemoryStore } from "../src/persistence/operational-memory-store.js";

const REPOSITORY_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

class FakeResponsesClient {
  constructor() { this.calls = []; this.release = null; }
  async readiness({ checkedAt } = {}) {
    return { status: "READY", label: "OpenAI API ready", detail: "Configured locally.", authentication: "API key configured", checkedAt };
  }
  async runWorkflow({ input, allowWebSearch, onEvent }) {
    this.calls.push({ input, allowWebSearch });
    if (this.release) await this.release;
    const searchesPerformed = allowWebSearch ? 6 : 0;
    onEvent?.({ type: "response.completed", searchesPerformed, sourceCount: allowWebSearch ? 6 : 0 });
    return { outputText: "{}", responseId: "resp_synthetic", searchesPerformed, sources: [] };
  }
  async close() {}
}

async function withManager(run, { studentProfileStore = null } = {}) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "internship-run-manager-test-"));
  const memoryStore = await new OperationalMemoryStore({ rootDir: path.join(directory, "memory") }).initialize();
  const client = new FakeResponsesClient();
  const manager = new RunNowManager({
    workspaceRoot: REPOSITORY_ROOT,
    memoryStore,
    clientFactory: () => client,
    clock: () => new Date("2026-08-25T12:00:00.000Z"),
    idFactory: (() => { let counter = 0; return () => `generated-${++counter}`; })(),
    studentProfileStore: studentProfileStore ?? readyDemoStore(),
  });
  try { await run({ manager, memoryStore, client }); }
  finally { await manager.close(); await rm(directory, { recursive: true, force: true }); }
}

test("Collect uses a task-scoped bounded API request and records completion", async () => {
  await withManager(async ({ manager, memoryStore, client }) => {
    const started = manager.startCollection();
    const completed = await manager.waitForRun(started.runId);
    assert.equal(completed.outcome, "SUCCESS");
    assert.equal(completed.searchesPerformed, 6);
    assert.equal(completed.progressPercent, 100);
    assert.equal(client.calls[0].allowWebSearch, true);
    assert.match(client.calls[0].input, /no more than 10 targeted public-web searches/i);
    assert.match(client.calls[0].input, /agent\/skills\/job-fit-assessment\/SKILL\.md/);
    assert.match(client.calls[0].input, /Explicitly selected synthetic demonstration setup/);
    assert.doesNotMatch(client.calls[0].input, /sk-[A-Za-z0-9_-]{12,}/);
    assert.equal((await memoryStore.list("run"))[0].providerResponseId, "resp_synthetic");
  });
});

test("confirmed private resume evidence replaces the synthetic resume in task-scoped input", async () => {
  const studentProfileStore = {
    async snapshot() {
      return { readyForCollection: true, mode: "REAL", activeLabel: "Confirmed real-student setup", missingItems: [] };
    },
    async activeStudentContext() {
      return {
        mode: "REAL",
        sourceType: "PRIVATE_CONFIRMED",
        sourceLabel: "Student-confirmed private non-identifying setup",
        confirmedAt: "2026-09-26T12:00:00.000Z",
        resume: "EDUCATION\nBSBA Information Systems\nSKILLS\nSQL and Excel",
        preferencesAndConstraints: {
          preferredRoles: ["AI Business Analyst Intern"],
          availabilityStart: "2027-05-15",
          availabilityEnd: "2027-08-31",
          hoursPerWeek: 40,
          workArrangements: ["HYBRID"],
          geographicLimits: "California",
          paidRequirement: "REQUIRED",
          relocation: "NO",
          workAuthorization: "AUTHORIZED_NO_SPONSORSHIP",
        },
      };
    },
  };
  await withManager(async ({ manager, client }) => {
    const started = manager.startCollection();
    await manager.waitForRun(started.runId);
    assert.match(client.calls[0].input, /source_type="PRIVATE_CONFIRMED"/);
    assert.match(client.calls[0].input, /BSBA Information Systems/);
    assert.doesNotMatch(client.calls[0].input, /repository_document path="context\/is-junior-resume\.md"/);
  }, { studentProfileStore });
});

test("incomplete student setup stops before provider readiness or workflow calls", async () => {
  const studentProfileStore = {
    async snapshot() {
      return { readyForCollection: false, mode: "REAL", missingItems: ["Upload and confirm a resume"] };
    },
  };
  await withManager(async ({ manager, client }) => {
    const started = manager.startCollection();
    const completed = await manager.waitForRun(started.runId);
    assert.equal(completed.outcome, "FAILURE");
    assert.equal(completed.error.code, "STUDENT_SETUP_INCOMPLETE");
    assert.match(completed.error.message, /Upload and confirm a resume/);
    assert.equal(client.calls.length, 0);
  }, { studentProfileStore });
});

test("Update Opportunity processes one saved response without web discovery", async () => {
  await withManager(async ({ manager, memoryStore, client }) => {
    await memoryStore.upsertOpportunityState("opp-update-001", {
      studentInput: {
        responseId: "response-update-001", opportunityId: "opp-update-001", type: "PROVIDE_INFORMATION",
        text: "I can work the required Tuesday schedule.", templateTypes: [],
        submittedAt: "2026-08-25T12:00:00.000Z", status: "READY_FOR_UPDATE",
      },
    });
    const opportunity = { opportunityId: "opp-update-001", company: "Northstar", roleTitle: "IS Intern", postingStatus: "ACTIVE" };
    const started = manager.startUpdate({ opportunityId: opportunity.opportunityId, opportunity, responseId: "response-update-001" });
    const completed = await manager.waitForRun(started.runId);
    assert.equal(completed.outcome, "SUCCESS");
    assert.equal(completed.searchesPerformed, 0);
    assert.equal(client.calls[0].allowWebSearch, false);
    assert.match(client.calls[0].input, /process only existing opportunity opp-update-001/i);
    assert.match(client.calls[0].input, /response-update-001/);
  });
});

test("reports sanitized API readiness", async () => {
  await withManager(async ({ manager }) => {
    const readiness = await manager.checkRuntimeReadiness();
    assert.equal(readiness.status, "READY");
    assert.equal(readiness.authentication, "API key configured");
    assert.doesNotMatch(JSON.stringify(readiness), /sk-/);
  });
});

test("prevents simultaneous duplicate workflows", async () => {
  await withManager(async ({ manager, client }) => {
    let release;
    client.release = new Promise((resolve) => { release = resolve; });
    const started = manager.startCollection();
    assert.throws(() => manager.startCollection(), RunAlreadyActiveError);
    release();
    await manager.waitForRun(started.runId);
  });
});

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
        resume: "SYNTHETIC RESUME\nInformation Systems student with SQL and Excel.",
        preferences: "Preferred internship roles include AI Business Analyst Intern.",
        constraints: "Available for a Summer 2027 paid internship in California.",
      };
    },
  };
}
