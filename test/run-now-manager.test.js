import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { RUN_NOW_INSTRUCTION, RunAlreadyActiveError, RunNowManager } from "../src/controller/run-now-manager.js";
import { OperationalMemoryStore } from "../src/persistence/operational-memory-store.js";

class FakeCodexClient extends EventEmitter {
  constructor() {
    super();
    this.calls = [];
    this.responses = [];
  }

  async initialize() {
    this.calls.push(["initialize"]);
  }

  async readAccount(params) {
    this.calls.push(["readAccount", params]);
    return { account: { type: "chatgpt", email: "not-exposed@example.edu", planType: "synthetic" }, requiresOpenaiAuth: true };
  }

  async startThread(params) {
    this.calls.push(["startThread", params]);
    return { thread: { id: "thr_test" } };
  }

  async resumeThread(threadId, params) {
    this.calls.push(["resumeThread", threadId, params]);
    return { thread: { id: threadId } };
  }

  async startTurn(threadId, input, params) {
    this.calls.push(["startTurn", threadId, input, params]);
    const targetedUpdate = input?.[0]?.text?.includes("Update Opportunity mode");
    queueMicrotask(() => {
      this.emit("notification", {
        method: "turn/started",
        params: { turn: { id: "turn_test", status: "inProgress" } },
      });
      if (!targetedUpdate) {
        this.emit("notification", {
          method: "item/started",
          params: { item: { id: "web_1", type: "webSearch", action: { type: "search" } } },
        });
        this.emit("notification", {
          method: "item/completed",
          params: {
            item: {
              id: "web_1",
              type: "webSearch",
              action: { type: "search", queries: ["query one", "query two", "query three"] },
            },
          },
        });
      }
      this.emit("notification", {
        method: "turn/completed",
        params: { turn: { id: "turn_test", status: "completed" } },
      });
    });
    return { turn: { id: "turn_test" } };
  }

  respondResult(id, result) {
    this.responses.push({ id, result });
  }

  async close() {}
}

async function withManager(run) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "internship-run-manager-test-"));
  const memoryStore = await new OperationalMemoryStore({ rootDir: path.join(directory, "memory") }).initialize();
  const client = new FakeCodexClient();
  const manager = new RunNowManager({
    workspaceRoot: directory,
    memoryStore,
    clientFactory: () => client,
    clock: () => new Date("2026-08-25T12:00:00.000Z"),
    idFactory: (() => {
      let counter = 0;
      return () => `generated-${++counter}`;
    })(),
  });
  try {
    await run({ manager, memoryStore, client, directory });
  } finally {
    await manager.close();
    await rm(directory, { recursive: true, force: true });
  }
}

test("Run Now uses the bounded approved instruction and records completion", async () => {
  await withManager(async ({ manager, memoryStore, client }) => {
    const events = [];
    manager.on("event", (event) => events.push(event));
    const started = manager.startRun();
    assert.equal(started.active, true);
    const completed = await manager.waitForRun(started.runId);

    assert.equal(completed.outcome, "SUCCESS");
    assert.equal(completed.stage, "FINISHED");
    assert.equal(completed.searchesPerformed, 3);
    assert.equal(completed.workflowType, "COLLECT");
    assert.equal(completed.progressPercent, 100);
    const turnCall = client.calls.find(([method]) => method === "startTurn");
    assert.match(turnCall[2][0].text, /no more than 3 targeted public-web searches/);
    assert.match(turnCall[2][0].text, /Greenhouse, Lever, or Ashby postings first/);
    assert.match(turnCall[2][0].text, /SimplifyJobs Summer 2027 GitHub list/);
    assert.match(turnCall[2][0].text, /USAJOBS Student Opportunities/);
    assert.match(turnCall[2][0].text, /CalCareers Student Employment/);
    assert.match(turnCall[2][0].text, /LinkedIn, Indeed, or Wellfound only as public-access fallbacks/);
    assert.match(turnCall[2][0].text, /never bypass login or access controls/);
    assert.match(turnCall[2][0].text, /Do not directly edit the internship spreadsheet/);
    assert.match(turnCall[2][0].text, /Return the final business result as one JSON object only/);
    assert.equal(turnCall[2][0].text, RUN_NOW_INSTRUCTION);
    assert.equal(turnCall[2][1].type, "skill");
    assert.equal(turnCall[2][1].name, "job-fit-assessment");
    assert.match(turnCall[2][1].path, /agent[\\/]skills[\\/]job-fit-assessment[\\/]SKILL\.md$/);
    assert.equal(events.some((event) => event.type === "run.completed"), true);
    assert.equal((await memoryStore.list("run"))[0].outcome, "SUCCESS");
    assert.equal((await memoryStore.getState()).runtime.threadId, "thr_test");
    assert.deepEqual(client.calls.find(([method]) => method === "readAccount"), ["readAccount", { refreshToken: false }]);
  });
});

test("Update Opportunity processes one saved response without web discovery", async () => {
  await withManager(async ({ manager, memoryStore, client }) => {
    await memoryStore.upsertOpportunityState("opp-update-001", {
      studentInput: {
        responseId: "response-update-001",
        opportunityId: "opp-update-001",
        type: "PROVIDE_INFORMATION",
        text: "I can work the required Tuesday schedule.",
        templateTypes: [],
        submittedAt: "2026-08-25T12:00:00.000Z",
        status: "READY_FOR_UPDATE",
      },
    });
    const opportunity = {
      opportunityId: "opp-update-001",
      company: "Northstar",
      roleTitle: "IS Intern",
      postingUrl: "https://careers.example.edu/jobs/opp-update-001",
      applicationUrl: "https://apply.example.edu/jobs/opp-update-001",
      source: "Employer career page",
      postingStatus: "ACTIVE",
      nextAction: "Confirm Tuesday availability",
    };
    const started = manager.startUpdate({
      opportunityId: opportunity.opportunityId,
      opportunity,
      responseId: "response-update-001",
    });
    const completed = await manager.waitForRun(started.runId);
    assert.equal(completed.workflowType, "UPDATE");
    assert.equal(completed.targetOpportunityId, "opp-update-001");
    assert.equal(completed.searchesPerformed, 0);
    assert.equal(completed.progressPercent, 100);
    const turnCall = client.calls.find(([method]) => method === "startTurn");
    assert.match(turnCall[2][0].text, /process only existing opportunity opp-update-001/);
    assert.match(turnCall[2][0].text, /do not search the web/);
    assert.match(turnCall[2][0].text, /Targeted-update rules/);
    assert.match(turnCall[2][2].text, /response-update-001/);
    assert.doesNotMatch(JSON.stringify(client.calls), /query one/);
  });
});

test("reports sanitized Codex readiness without exposing account identity", async () => {
  await withManager(async ({ manager }) => {
    const readiness = await manager.checkRuntimeReadiness();
    assert.equal(readiness.status, "READY");
    assert.equal(readiness.authentication, "ChatGPT managed sign-in");
    assert.doesNotMatch(JSON.stringify(readiness), /not-exposed|example\.edu|synthetic/);
  });
});

test("uses installed Outlook runtime state when the app directory cannot be listed", async () => {
  await withManager(async ({ manager, client }) => {
    client.listApps = async () => {
      throw new Error("Request failed with status 403 Forbidden: <html><style>private provider page</style></html>");
    };
    client.installedApps = async () => ({
      apps: [{ id: "outlook-email", runtimeName: "Outlook Email", enabled: true, callable: true }],
    });

    const readiness = await manager.checkOutlookReadiness();
    assert.equal(readiness.status, "CONNECTED");
    assert.equal(readiness.appId, "outlook-email");
    assert.doesNotMatch(JSON.stringify(readiness), /html|style|provider page/i);
  });
});

test("reports an app-access restriction without exposing the provider response", async () => {
  await withManager(async ({ manager, client }) => {
    const denied = async () => {
      throw new Error("Request failed with status 403 Forbidden: <html><style>private provider page</style></html>");
    };
    client.listApps = denied;
    client.installedApps = denied;

    const readiness = await manager.checkOutlookReadiness();
    assert.equal(readiness.status, "ACCESS_BLOCKED");
    assert.equal(readiness.label, "Outlook access unavailable");
    assert.match(readiness.detail, /not permitted/);
    assert.doesNotMatch(JSON.stringify(readiness), /html|style|provider page/i);
  });
});

test("prevents simultaneous duplicate runs", async () => {
  await withManager(async ({ manager }) => {
    const started = manager.startRun();
    assert.throws(() => manager.startRun(), RunAlreadyActiveError);
    await manager.waitForRun(started.runId);
  });
});

test("surfaces approval requests and returns only an explicit student decision", async () => {
  await withManager(async ({ manager, client, memoryStore }) => {
    const events = [];
    manager.on("event", (event) => events.push(event));
    const started = manager.startRun();
    client.emit("server-request", {
      id: 99,
      method: "item/commandExecution/requestApproval",
      params: {
        reason: "Run approved local verification; token=do-not-display",
        command: ["node", "check.js", "API_KEY=do-not-display"],
        cwd: "C:\\synthetic\\workspace",
      },
    });
    const approval = events.find((event) => event.type === "approval.requested").approval;
    assert.match(approval.reason, /token=\[REDACTED\]/i);
    assert.doesNotMatch(JSON.stringify(approval.command), /do-not-display/);
    assert.equal(client.responses.length, 0);

    await manager.respondToApproval(approval.approvalId, "decline");
    assert.deepEqual(client.responses[0], { id: 99, result: { decision: "decline" } });
    assert.equal((await memoryStore.list("action"))[0].outcome, "DECLINE");
    await manager.waitForRun(started.runId);
  });
});
