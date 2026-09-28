import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { OperationalMemoryStore } from "../src/persistence/operational-memory-store.js";
import { createDashboardServer } from "../src/server/dashboard-server.js";

class FakeRunManager extends EventEmitter {
  constructor() {
    super();
    this.current = null;
    this.pendingApprovals = [];
    this.started = 0;
    this.updates = [];
    this.approvalResponses = [];
    this.setupReady = true;
  }

  snapshot() {
    return this.current;
  }

  async checkRuntimeReadiness() {
    return {
      status: "READY",
      label: "OpenAI API ready",
      detail: "The server-side API configuration is available for Collect and targeted opportunity updates.",
      authentication: "API key configured",
      checkedAt: "2026-08-25T12:00:00.000Z",
      diagnosticCode: null,
    };
  }

  async validateRuntimeConnection() {
    return this.checkRuntimeReadiness();
  }

  async checkStudentSetupReadiness() {
    return this.setupReady
      ? { ready: true, status: "READY", missingItems: [], detail: "Student setup is ready." }
      : { ready: false, status: "STUDENT_SETUP_INCOMPLETE", missingItems: ["Upload and confirm a resume"], detail: "Complete student setup before collection or assessment: Upload and confirm a resume." };
  }

  startRun() {
    this.started += 1;
    this.current = {
      runId: "run-dashboard-test",
      active: true,
      trigger: "RUN_NOW",
      stage: "RETRIEVING_PREFERENCES",
      label: "Retrieving Preferences",
      outcome: "IN_PROGRESS",
      startedAt: "2026-08-25T11:59:30.000Z",
      finishedAt: null,
      searchesPerformed: 0,
    };
    return this.current;
  }

  startCollection() {
    return this.startRun();
  }

  startUpdate({ opportunityId, opportunity, responseId }) {
    this.updates.push({ opportunityId, opportunity, responseId });
    this.current = {
      runId: "run-update-dashboard-test",
      active: true,
      trigger: "OPPORTUNITY_UPDATE",
      workflowType: "UPDATE",
      targetOpportunityId: opportunityId,
      targetLabel: `${opportunity.company} — ${opportunity.roleTitle}`,
      stage: "RETRIEVING_PREFERENCES",
      label: "Retrieving Preferences",
      statusDetail: `Reading the saved response for ${opportunity.company} — ${opportunity.roleTitle}.`,
      progressPercent: 6,
      outcome: "IN_PROGRESS",
      startedAt: "2026-08-25T11:59:30.000Z",
      finishedAt: null,
      searchesPerformed: 0,
    };
    return this.current;
  }

  async respondToApproval(approvalId, decision) {
    this.approvalResponses.push({ approvalId, decision });
    return { approvalId, decision };
  }
}

async function withDashboard(run) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "internship-dashboard-test-"));
  const memoryStore = await new OperationalMemoryStore({ rootDir: path.join(directory, "memory") }).initialize();
  const runManager = new FakeRunManager();
  const spreadsheetTracker = {
    async readRecords() {
      return [
        {
          opportunityId: "opp-dashboard-001",
          company: "Northstar Retail Analytics",
          roleTitle: "Information Systems Intern",
          location: "San Luis Obispo, CA",
          workArrangement: "Hybrid",
          deadline: "2026-09-01",
          source: "Employer career page",
          postingUrl: "https://careers.example.edu/jobs/opp-dashboard-001",
          applicationUrl: "https://apply.example.edu/jobs/opp-dashboard-001",
          postingStatus: "ACTIVE",
          fitAssessment: "Strong",
          agentDecision: "PRIORITIZE",
          applicationStatus: "NOT STARTED",
          nextAction: "Review posting",
          unresolvedIssue: "",
        },
      ];
    },
    async getOpportunity(opportunityId) {
      return (await this.readRecords()).find((record) => record.opportunityId === opportunityId) ?? null;
    },
  };
  const runtimePaths = {
    root: directory,
    memory: path.join(directory, "memory"),
    spreadsheet: path.join(directory, "internship_pipeline.xlsx"),
  };
  const notificationConfiguration = {
    current: null,
    async snapshot() {
      return {
        configured: Boolean(this.current),
        recipientHint: this.current ? "st*****@example.edu" : null,
        mode: "DRY_RUN",
        deliveryStatus: "LOCAL_PREVIEW_ONLY",
        explanation: "Material updates create a local email preview.",
      };
    },
    async setRecipient(email) {
      if (!String(email).includes("@")) throw new TypeError("Enter a valid student notification email address.");
      this.current = email;
      return this.snapshot();
    },
  };
  const scheduleConfiguration = {
    current: { enabled: false, time: "09:00" },
    async snapshot() {
      return { ...this.current, status: this.current.enabled ? "ENABLED" : "DISABLED", schedule: this.current.enabled ? `${this.current.time} daily while this app is running` : "Disabled", timezone: "America/Los_Angeles", lastRun: null, nextRun: null, managedBy: "Local controller" };
    },
    async configure({ enabled, time }) {
      if (!/^\d{2}:\d{2}$/.test(String(time))) throw new TypeError("Choose a valid local daily time.");
      this.current = { enabled: Boolean(enabled), time };
      return this.snapshot();
    },
  };
  const studentResponseService = {
    submissions: [],
    started: [],
    async submit(payload) {
      this.submissions.push(payload);
      return {
        responseId: "response-dashboard-001",
        opportunityId: payload.opportunityId,
        status: "READY_FOR_UPDATE",
        nextStep: "The targeted update will start now.",
      };
    },
    async markUpdateStarted(payload) {
      this.started.push(payload);
    },
    async markUpdateDeferred() {},
  };
  const localResetService = {
    requests: [],
    async reset(payload) {
      this.requests.push(payload);
      if (payload.confirmation !== "RESET") throw new TypeError("Enter RESET to confirm the fresh-start archive and reset.");
      return {
        resetAt: "2026-08-25T12:00:00.000Z",
        opportunitiesCleared: 1,
        archivePath: path.join(directory, "reset-archives", "synthetic-reset"),
        spreadsheetPath: runtimePaths.spreadsheet,
      };
    },
  };
  const applicationMaterialStore = {
    async listMaterials() { return []; },
    async readMaterial(materialId) {
      if (materialId !== "material-dashboard-001") return null;
      return {
        materialId,
        fileName: "cover-letter-outline.docx",
        contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        bytes: Buffer.from([0x50, 0x4b, 0x03, 0x04]),
      };
    },
  };
  const studentProfileStore = {
    uploads: [],
    confirmations: [],
    contextSaves: [],
    active: false,
    mode: "DEMO",
    context: null,
    pending: null,
    async snapshot() {
      return {
        status: this.mode === "DEMO" ? "SYNTHETIC_DEMONSTRATION_ACTIVE" : this.active && this.context ? "REAL_STUDENT_READY" : this.pending ? "AWAITING_CONFIRMATION" : "SETUP_INCOMPLETE",
        mode: this.mode,
        readyForCollection: this.mode === "DEMO" || Boolean(this.active && this.context),
        missingItems: this.mode === "DEMO" || (this.active && this.context) ? [] : [this.active ? "Save preferred roles, availability, and constraints" : "Upload and confirm a resume"],
        activeSource: this.mode === "DEMO" ? "SYNTHETIC_DEMONSTRATION" : this.active && this.context ? "PRIVATE_CONFIRMED" : "SETUP_INCOMPLETE",
        activeLabel: this.mode === "DEMO" ? "Synthetic demonstration setup" : this.active && this.context ? "Confirmed real-student setup" : "Student setup incomplete",
        pending: this.pending,
        confirmed: this.active ? { fileName: "resume.txt", confirmedAt: "2026-08-25T12:00:00.000Z" } : null,
        previewText: this.pending ? "EDUCATION\nBSBA Information Systems\nSKILLS\nSQL and Excel" : null,
        requiresConfirmation: Boolean(this.pending),
        preferencesSource: this.mode === "DEMO" ? "Synthetic career-preferences.md" : this.context ? "Confirmed local student preferences" : "Not confirmed",
        constraintsSource: this.mode === "DEMO" ? "Synthetic availability-and-constraints.md" : this.context ? "Confirmed local availability and constraints" : "Not confirmed",
        preferencesAndConstraints: this.context,
        defaultRoleChoices: ["AI Business Analyst Intern", "AI Systems Analyst Intern"],
      };
    },
    async uploadResume(payload) { this.uploads.push(payload); this.pending = { fileName: payload.fileName }; return this.snapshot(); },
    async confirmProfile(payload) { this.confirmations.push(payload); if (!payload.identifyingDetailsRemoved) throw new TypeError("Confirm identifiers were removed."); this.pending = null; this.active = true; this.mode = "REAL"; return this.snapshot(); },
    async savePreferencesAndConstraints(payload) { this.contextSaves.push(payload); this.context = { ...payload, confirmedAt: "2026-08-25T12:00:00.000Z" }; this.mode = "REAL"; return this.snapshot(); },
    async activateDemo() { this.mode = "DEMO"; return this.snapshot(); },
    async activateReal() { this.mode = "REAL"; return this.snapshot(); },
    async deactivate() { this.active = false; this.mode = null; return this.snapshot(); },
  };
  const dashboard = createDashboardServer({
    runManager,
    spreadsheetTracker,
    memoryStore,
    runtimePaths,
    notificationConfiguration,
    scheduleConfiguration,
    studentResponseService,
    applicationMaterialStore,
    localResetService,
    studentProfileStore,
    requestToken: "synthetic-local-token",
    clock: () => new Date("2026-08-25T12:00:00.000Z"),
  });
  const address = await dashboard.listen({ port: 0 });
  try {
    await run({ dashboard, address, runManager, memoryStore, notificationConfiguration, scheduleConfiguration, studentResponseService, runtimePaths, localResetService, studentProfileStore });
  } finally {
    await dashboard.close();
    await rm(directory, { recursive: true, force: true });
  }
}

test("serves the meaningful dashboard, local storage location, and evidence-backed fit details", async () => {
  await withDashboard(async ({ address, memoryStore, runtimePaths }) => {
    await memoryStore.appendDecision({
      runId: "run-fit-001",
      opportunityId: "opp-dashboard-001",
      decision: "PRIORITIZE",
      rationale: "Verified SQL and process-analysis experience align with the role.",
      evidence: {
        requiredMatches: ["SQL is verified in the student context."],
        preferredMatches: [],
        preferenceAlignment: ["Hybrid work matches the student's preference."],
        gaps: ["No industry-specific experience is verified."],
        unknowns: ["Compensation is not stated."],
      },
      fitAssessment: "STRONG",
    });
    await memoryStore.upsertOpportunityState("opp-dashboard-001", {
      studentInput: {
        responseId: "response-prior-001",
        status: "NEEDS_MORE_INFORMATION",
        nextStep: "Confirm whether Tuesday availability is compatible.",
      },
    });
    const page = await fetch(address.url);
    assert.equal(page.status, 200);
    assert.match(page.headers.get("content-security-policy"), /frame-ancestors 'none'/);
    assert.match(await page.text(), /Find strong opportunities/);

    const response = await fetch(`${address.url}/api/dashboard`);
    const body = await response.json();
    assert.equal(body.application.localStatus, "Local only");
    assert.equal(body.application.name, "Internship Application Prep Agent");
    assert.equal(body.metrics.totalTracked, 1);
    assert.equal(body.metrics.prioritize, 1);
    assert.equal(body.metrics.needsAttention, 1);
    assert.equal(body.attentionItems[0].actionLabel, "Update Opportunity");
    assert.match(body.attentionItems[0].prompt, /Tuesday availability/);
    assert.equal(body.collection[0].company, "Northstar Retail Analytics");
    assert.match(body.collection[0].decisionRationale, /Verified SQL/);
    assert.deepEqual(body.collection[0].fitEvidence.requiredMatches, ["SQL is verified in the student context."]);
    assert.equal(body.collection[0].applicationUrl, "https://apply.example.edu/jobs/opp-dashboard-001");
    assert.equal(body.collection[0].postingUrl, "https://careers.example.edu/jobs/opp-dashboard-001");
    assert.equal(body.sync.spreadsheetPath, runtimePaths.spreadsheet);
    assert.equal(body.sync.runtimeFolder, runtimePaths.root);
    assert.equal(body.notificationSettings.deliveryStatus, "LOCAL_PREVIEW_ONLY");
    assert.equal(body.application.requestToken, "synthetic-local-token");
    assert.equal(body.runtime.status, "READY");
    assert.equal(body.runtime.authentication, "API key configured");
    assert.equal(body.studentProfile.activeSource, "SYNTHETIC_DEMONSTRATION");
    assert.doesNotMatch(JSON.stringify(body.runtime), /email|planType/i);
    assert.equal("root" in body, false);
  });
});

test("runtime connection validation uses the protected local endpoint", async () => {
  await withDashboard(async ({ address }) => {
    const denied = await fetch(`${address.url}/api/runtime/validate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    assert.equal(denied.status, 403);
    const accepted = await fetch(`${address.url}/api/runtime/validate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Local-Request-Token": "synthetic-local-token" },
      body: "{}",
    });
    assert.equal(accepted.status, 200);
    assert.equal((await accepted.json()).runtime.status, "READY");
  });
});

test("resume upload and confirmation stay behind the local mutation boundary", async () => {
  await withDashboard(async ({ address, studentProfileStore }) => {
    const payload = {
      fileName: "resume.txt",
      mediaType: "text/plain",
      dataBase64: Buffer.from("EDUCATION\nBSBA Information Systems\nSKILLS\nSQL and Excel").toString("base64"),
    };
    const denied = await fetch(`${address.url}/api/profile/resume`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    assert.equal(denied.status, 403);

    const uploaded = await fetch(`${address.url}/api/profile/resume`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Local-Request-Token": "synthetic-local-token" },
      body: JSON.stringify(payload),
    });
    assert.equal(uploaded.status, 201);
    assert.equal((await uploaded.json()).profile.requiresConfirmation, true);
    assert.equal(studentProfileStore.uploads.length, 1);

    const confirmed = await fetch(`${address.url}/api/profile/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Local-Request-Token": "synthetic-local-token" },
      body: JSON.stringify({ profileText: "EDUCATION\nBSBA Information Systems\nSKILLS\nSQL and Excel", identifyingDetailsRemoved: true }),
    });
    assert.equal(confirmed.status, 200);
    const confirmedProfile = (await confirmed.json()).profile;
    assert.equal(confirmedProfile.activeSource, "SETUP_INCOMPLETE");
    assert.deepEqual(confirmedProfile.missingItems, ["Save preferred roles, availability, and constraints"]);
    assert.equal(studentProfileStore.confirmations.length, 1);
  });
});

test("student preferences and constraints use protected local endpoints and explicit setup modes", async () => {
  await withDashboard(async ({ address, studentProfileStore }) => {
    const context = {
      preferredRoles: ["AI Business Analyst Intern"],
      customRole: "",
      availabilityStart: "2027-05-15",
      availabilityEnd: "2027-08-31",
      hoursPerWeek: 40,
      workArrangements: ["HYBRID", "REMOTE"],
      geographicLimits: "California or remote from California",
      paidRequirement: "REQUIRED",
      relocation: "NO",
      workAuthorization: "UNSURE_OR_PREFER_NOT_TO_STATE",
      additionalConstraints: "",
      confirmed: true,
    };
    const denied = await fetch(`${address.url}/api/profile/context`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(context),
    });
    assert.equal(denied.status, 403);

    const saved = await fetch(`${address.url}/api/profile/context`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Local-Request-Token": "synthetic-local-token" },
      body: JSON.stringify(context),
    });
    assert.equal(saved.status, 200);
    assert.equal(studentProfileStore.contextSaves.length, 1);
    assert.equal((await saved.json()).profile.mode, "REAL");

    const demo = await fetch(`${address.url}/api/profile/demo`, {
      method: "POST", headers: { "Content-Type": "application/json", "X-Local-Request-Token": "synthetic-local-token" }, body: "{}",
    });
    assert.equal(demo.status, 200);
    assert.equal((await demo.json()).profile.readyForCollection, true);
  });
});

test("collection and assessment are rejected before student setup is complete", async () => {
  await withDashboard(async ({ address, runManager, studentResponseService }) => {
    runManager.setupReady = false;
    const headers = { "Content-Type": "application/json", "X-Local-Request-Token": "synthetic-local-token" };
    const collect = await fetch(`${address.url}/api/collect`, { method: "POST", headers, body: "{}" });
    assert.equal(collect.status, 409);
    assert.match((await collect.json()).error, /Upload and confirm a resume/);
    assert.equal(runManager.started, 0);

    const update = await fetch(`${address.url}/api/opportunities/opp-dashboard-001/update`, {
      method: "POST",
      headers,
      body: JSON.stringify({ type: "PROVIDE_INFORMATION", text: "I can work Tuesdays.", templateTypes: [] }),
    });
    assert.equal(update.status, 409);
    assert.equal(studentResponseService.submissions.length, 0);
  });
});

test("Collect requires the per-process local request token", async () => {
  await withDashboard(async ({ address, runManager }) => {
    const rejected = await fetch(`${address.url}/api/collect`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    assert.equal(rejected.status, 403);
    assert.equal(runManager.started, 0);

    const accepted = await fetch(`${address.url}/api/collect`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Local-Request-Token": "synthetic-local-token",
      },
      body: "{}",
    });
    assert.equal(accepted.status, 202);
    assert.equal(runManager.started, 1);

    const dashboardResponse = await fetch(`${address.url}/api/dashboard`);
    const snapshot = await dashboardResponse.json();
    assert.equal(snapshot.run.durationMs, 30_000);
    assert.equal(snapshot.run.firstRun, true);
  });
});

test("Update Opportunity saves the response and immediately starts one targeted workflow", async () => {
  await withDashboard(async ({ address, runManager, studentResponseService }) => {
    const response = await fetch(`${address.url}/api/opportunities/opp-dashboard-001/update`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Local-Request-Token": "synthetic-local-token",
      },
      body: JSON.stringify({
        type: "PROVIDE_INFORMATION",
        text: "I can meet the required Tuesday schedule.",
        templateTypes: [],
      }),
    });
    assert.equal(response.status, 202);
    const body = await response.json();
    assert.equal(body.run.workflowType, "UPDATE");
    assert.equal(body.run.targetOpportunityId, "opp-dashboard-001");
    assert.equal(runManager.updates.length, 1);
    assert.equal(runManager.started, 0);
    assert.equal(studentResponseService.submissions.length, 1);
    assert.deepEqual(studentResponseService.started[0], {
      opportunityId: "opp-dashboard-001",
      responseId: "response-dashboard-001",
      runId: "run-update-dashboard-test",
    });
  });
});

test("student notification email can be configured through the protected local endpoint", async () => {
  await withDashboard(async ({ address, notificationConfiguration }) => {
    const rejected = await fetch(`${address.url}/api/settings/notification`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "student@example.edu" }),
    });
    assert.equal(rejected.status, 403);

    const invalid = await fetch(`${address.url}/api/settings/notification`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Local-Request-Token": "synthetic-local-token" },
      body: JSON.stringify({ email: "not-an-email" }),
    });
    assert.equal(invalid.status, 400);

    const saved = await fetch(`${address.url}/api/settings/notification`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Local-Request-Token": "synthetic-local-token" },
      body: JSON.stringify({ email: "student@example.edu" }),
    });
    assert.equal(saved.status, 200);
    assert.equal(notificationConfiguration.current, "student@example.edu");
    assert.equal((await saved.json()).settings.configured, true);
  });
});

test("daily collection can be configured through the protected local endpoint", async () => {
  await withDashboard(async ({ address }) => {
    const denied = await fetch(`${address.url}/api/settings/schedule`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: true, time: "09:30" }),
    });
    assert.equal(denied.status, 403);
    const accepted = await fetch(`${address.url}/api/settings/schedule`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Local-Request-Token": "synthetic-local-token" },
      body: JSON.stringify({ enabled: true, time: "09:30" }),
    });
    assert.equal(accepted.status, 200);
    const body = await accepted.json();
    assert.equal(body.schedule.enabled, true);
    assert.equal(body.schedule.time, "09:30");
  });
});

test("Reset Collection requires the local token and exact confirmation", async () => {
  await withDashboard(async ({ address, localResetService }) => {
    const rejected = await fetch(`${address.url}/api/reset`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmation: "RESET" }),
    });
    assert.equal(rejected.status, 403);

    const invalid = await fetch(`${address.url}/api/reset`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Local-Request-Token": "synthetic-local-token" },
      body: JSON.stringify({ confirmation: "reset" }),
    });
    assert.equal(invalid.status, 400);

    const accepted = await fetch(`${address.url}/api/reset`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Local-Request-Token": "synthetic-local-token" },
      body: JSON.stringify({ confirmation: "RESET" }),
    });
    assert.equal(accepted.status, 200);
    assert.equal((await accepted.json()).result.opportunitiesCleared, 1);
    assert.equal(localResetService.requests.length, 2);
  });
});

test("application materials download as Word documents", async () => {
  await withDashboard(async ({ address }) => {
    const response = await fetch(`${address.url}/api/materials/material-dashboard-001`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-type"), "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    assert.match(response.headers.get("content-disposition"), /cover-letter-outline\.docx/);
    assert.deepEqual([...new Uint8Array(await response.arrayBuffer())], [0x50, 0x4b, 0x03, 0x04]);
  });
});

test("a notification-settings failure does not prevent the dashboard from loading", async () => {
  await withDashboard(async ({ address, notificationConfiguration }) => {
    notificationConfiguration.snapshot = async () => {
      throw new Error("synthetic settings failure");
    };

    const response = await fetch(`${address.url}/api/dashboard`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.metrics.totalTracked, 1);
    assert.equal(body.notificationSettings.deliveryStatus, "LOCAL_PREVIEW_ONLY");
    assert.match(body.notificationSettings.explanation, /No external email was sent/);
  });
});

test("approval decisions pass through the same protected local mutation boundary", async () => {
  await withDashboard(async ({ address, runManager }) => {
    const response = await fetch(`${address.url}/api/approvals/approval-001`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Local-Request-Token": "synthetic-local-token",
      },
      body: JSON.stringify({ decision: "decline" }),
    });
    assert.equal(response.status, 200);
    assert.deepEqual(runManager.approvalResponses, [{ approvalId: "approval-001", decision: "decline" }]);
  });
});

test("refuses non-loopback listener addresses", async () => {
  const runManager = new FakeRunManager();
  const memoryStore = {
    async getState() { return { runtime: {} }; },
    async list() { return []; },
  };
  const dashboard = createDashboardServer({
    runManager,
    spreadsheetTracker: { async readRecords() { return []; } },
    memoryStore,
    runtimePaths: { spreadsheet: "missing.xlsx" },
  });
  await assert.rejects(dashboard.listen({ host: "0.0.0.0", port: 0 }), /loopback/);
});
