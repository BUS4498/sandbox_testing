import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";
import path from "node:path";

import { CodexAppServerClient } from "./codex-app-server-client.js";
import { publicRuntimeEvent } from "./runtime-event-mapper.js";
import { publicRuntimeReadiness, unavailableRuntimeReadiness } from "./runtime-readiness.js";
import {
  UPDATE_WORKFLOW_RESULT_INSTRUCTION,
  WORKFLOW_RESULT_INSTRUCTION,
} from "../workflow/workflow-result-contract.js";

export const COLLECT_INSTRUCTION = `Run the Internship Application Prep Agent in Collect Opportunities mode.

Follow AGENTS.md, agent/agent.md, and the relevant workflow, tool, policy, memory, context, and Skill specifications.

For this run:
- use no more than 3 targeted public-web searches;
- use the approved prioritized source portfolio in agent/tools/internship-web-search.md: employer Greenhouse, Lever, or Ashby postings first; then Simplify, the SimplifyJobs Summer 2027 GitHub list, USAJOBS Student Opportunities, CalCareers Student Employment, or Built In; use LinkedIn, Indeed, or Wellfound only as public-access fallbacks;
- verify a secondary-source result against an employer-controlled posting when reasonably available, and never bypass login or access controls;
- collect no more than 15 candidate opportunities;
- select the top 3 to 5 relevant new or materially changed opportunities when at least 3 qualify;
- provide a specific selectionShortfallReason when fewer than 3 qualify;
- identify the exact permitted spreadsheet update, notification facts, and memory evidence for each selection;
- review any pending student response and prepare requested review-only application templates;
- record unresolved issues with a next action; and
- stop when the bounded run-completion conditions are met.

The thin local controller owns deterministic ACT, VERIFY, and REMEMBER operations. Do not directly edit the internship spreadsheet, send email, or write operational memory during the Codex turn. Return the structured business result below so the controller can validate limits, prevent duplicates, apply permitted changes exactly once, verify them, and record the outcome.

Do not submit applications, contact employers, fabricate qualifications, or expose private chain-of-thought.
${WORKFLOW_RESULT_INSTRUCTION}`;

// Retained as an API alias for older controller integrations and tests.
export const RUN_NOW_INSTRUCTION = COLLECT_INSTRUCTION;

export function buildUpdateInstruction({ opportunityId, opportunity }) {
  return `Run the Internship Application Prep Agent in Update Opportunity mode.

Follow AGENTS.md, agent/agent.md, and the relevant workflow, tool, policy, memory, context, and Skill specifications.

For this targeted update:
- process only existing opportunity ${opportunityId};
- review only the newly submitted student response supplied in this turn;
- do not search the web, discover candidates, rank other opportunities, or revisit the rest of the collection;
- reassess the opportunity only as needed to resolve the response, advance its next action, or prepare requested review-only application templates;
- identify any remaining information the student must provide in plain language;
- verify permitted local actions, update operational memory, and stop.

Existing user-facing opportunity snapshot:
${JSON.stringify(publicTargetOpportunity(opportunity))}

The thin local controller owns deterministic ACT, VERIFY, and REMEMBER operations. Do not directly edit the internship spreadsheet, send email, or write operational memory during the Codex turn. Return the structured business result below so the controller can apply the single targeted update exactly once.

Do not submit applications, contact employers, fabricate qualifications, expose private chain-of-thought, or process another opportunity.
${UPDATE_WORKFLOW_RESULT_INSTRUCTION}`;
}

export class RunAlreadyActiveError extends Error {
  constructor(runId) {
    super(`Run ${runId} is already active.`);
    this.name = "RunAlreadyActiveError";
    this.runId = runId;
  }
}

export class RunNowManager extends EventEmitter {
  #completionWaiters = new Map();
  #completedTurns = new Map();
  #pendingApprovals = new Map();
  #finalMessages = new Map();
  #observedSearchCounts = new Map();
  #mcpToolCalls = new Map();
  #readinessPromise = null;

  constructor({
    workspaceRoot,
    memoryStore,
    clientFactory,
    clock = () => new Date(),
    idFactory = randomUUID,
    workflowCoordinator = null,
  }) {
    super();
    if (!workspaceRoot) throw new TypeError("RunNowManager requires workspaceRoot.");
    if (!memoryStore) throw new TypeError("RunNowManager requires an operational memory store.");
    this.workspaceRoot = workspaceRoot;
    this.memoryStore = memoryStore;
    this.clock = clock;
    this.idFactory = idFactory;
    this.workflowCoordinator = workflowCoordinator;
    this.client = (clientFactory ?? (() => new CodexAppServerClient({ cwd: workspaceRoot })))();
    this.currentRun = null;
    this.#attachClientEvents();
  }

  get pendingApprovals() {
    return [...this.#pendingApprovals.values()].map((request) => request.publicView);
  }

  startCollection() {
    return this.#startWorkflow({
      trigger: "COLLECT_NOW",
      workflowType: "COLLECT",
      statusDetail: "Reading your verified preferences and current local collection before searching.",
    });
  }

  // Retained for compatibility with the original Run Now controller API.
  startRun() {
    return this.startCollection();
  }

  startUpdate({ opportunityId, opportunity, responseId } = {}) {
    if (!opportunityId || !opportunity) throw new TypeError("An existing opportunity is required for a targeted update.");
    const targetLabel = [opportunity.company, opportunity.roleTitle].filter(Boolean).join(" — ") || String(opportunityId);
    return this.#startWorkflow({
      trigger: "OPPORTUNITY_UPDATE",
      workflowType: "UPDATE",
      targetOpportunityId: String(opportunityId),
      targetOpportunity: structuredClone(opportunity),
      targetLabel,
      responseId: responseId ? String(responseId) : null,
      statusDetail: `Reading your new information for ${targetLabel}.`,
    });
  }

  #startWorkflow({ trigger, workflowType, targetOpportunityId = null, targetOpportunity = null, targetLabel = null, responseId = null, statusDetail }) {
    if (this.currentRun?.active) throw new RunAlreadyActiveError(this.currentRun.runId);
    const runId = this.idFactory();
    this.#observedSearchCounts.clear();
    const run = {
      runId,
      trigger,
      workflowType,
      targetOpportunityId,
      targetOpportunity,
      targetLabel,
      responseId,
      active: true,
      stage: "RETRIEVING_PREFERENCES",
      label: "Retrieving Preferences",
      statusDetail,
      progressPercent: 6,
      startedAt: this.clock().toISOString(),
      finishedAt: null,
      outcome: "IN_PROGRESS",
      threadId: null,
      turnId: null,
      searchesPerformed: 0,
      unresolvedIssues: 0,
    };
    this.currentRun = run;
    this.#publish({ type: "run.started", run: this.snapshot() });

    run.completion = this.#executeRun(run).catch((error) => this.#failRun(run, error));
    return this.snapshot();
  }

  async waitForRun(runId = this.currentRun?.runId) {
    if (!this.currentRun || this.currentRun.runId !== runId) return null;
    await this.currentRun.completion;
    return this.snapshot();
  }

  snapshot() {
    if (!this.currentRun) return null;
    const { completion, targetOpportunity, ...publicRun } = this.currentRun;
    return structuredClone(publicRun);
  }

  resetForFreshCollection() {
    if (this.currentRun?.active) throw new RunAlreadyActiveError(this.currentRun.runId);
    this.currentRun = null;
    this.#completionWaiters.clear();
    this.#completedTurns.clear();
    this.#pendingApprovals.clear();
    this.#finalMessages.clear();
    this.#observedSearchCounts.clear();
    this.#mcpToolCalls.clear();
  }

  async checkRuntimeReadiness() {
    if (this.#readinessPromise) return this.#readinessPromise;
    const checkedAt = this.clock().toISOString();
    const readinessPromise = (async () => {
      try {
        await this.client.initialize();
        const account = await this.client.readAccount({ refreshToken: false });
        return publicRuntimeReadiness(account, { checkedAt });
      } catch (error) {
        return unavailableRuntimeReadiness(error, { checkedAt });
      }
    })();
    this.#readinessPromise = readinessPromise;
    try {
      return await readinessPromise;
    } finally {
      if (this.#readinessPromise === readinessPromise) this.#readinessPromise = null;
    }
  }

  async checkOutlookReadiness({ forceRefresh = false } = {}) {
    try {
      await this.client.initialize();
      // A persisted thread may not be loaded into a newly started App Server.
      // App discovery is account-scoped, so omit a stale thread identifier.
      const threadId = this.currentRun?.threadId || undefined;
      const [listedResult, installedResult] = await Promise.allSettled([
        this.client.listApps({ threadId, forceRefetch: forceRefresh }),
        this.client.installedApps({ threadId, forceRefresh }),
      ]);
      const listed = listedResult.status === "fulfilled" ? listedResult.value : null;
      const installed = installedResult.status === "fulfilled" ? installedResult.value : null;
      const catalogApp = findOutlookApp(listed?.data ?? []);
      const installedApp = findOutlookApp((installed?.apps ?? []).map((item) => ({
        ...item,
        name: item.runtimeName,
      })));
      const app = catalogApp ?? (installedApp ? { id: installedApp.id, name: installedApp.runtimeName } : null);
      const runtime = (installed?.apps ?? []).find((item) => item.id === app?.id) ?? installedApp;

      if (!app) {
        const failures = [listedResult, installedResult].filter((result) => result.status === "rejected");
        if (failures.length > 0) return outlookProbeFailure(failures.map((result) => result.reason));
        return outlookReadiness("NOT_INSTALLED", "Outlook Email is not available to this Codex App Server session.");
      }
      if (catalogApp?.isAccessible === false) return outlookReadiness("NEEDS_CONNECTION", "Outlook Email needs to be connected in Codex.", app);
      if (catalogApp?.isEnabled === false || runtime?.enabled === false) return outlookReadiness("DISABLED", "Outlook Email is disabled in Codex.", app);
      if (!runtime?.callable) return outlookReadiness("NEEDS_CONNECTION", "Outlook Email is installed but is not currently callable.", app);
      return outlookReadiness("CONNECTED", "Outlook Email is connected and callable through Codex.", app);
    } catch (error) {
      return outlookProbeFailure([error]);
    }
  }

  async sendOutlookMessages(messages) {
    if (!Array.isArray(messages) || messages.length < 1 || messages.length > 5) {
      throw new TypeError("Outlook notification transport accepts one to five messages.");
    }
    if (!this.currentRun?.threadId) throw new Error("An approved internship-agent thread is required for Outlook notifications.");
    const readiness = await this.checkOutlookReadiness();
    if (readiness.status !== "CONNECTED" || !readiness.appId) {
      const error = new Error(readiness.detail);
      error.code = `OUTLOOK_${readiness.status}`;
      throw error;
    }
    const exactMessages = messages.map((message, index) => ({
      messageIndex: index,
      to: String(message.to),
      subject: String(message.subject),
      text: String(message.text),
    }));
    const input = [
      { type: "mention", name: readiness.appName || "Outlook Email", path: `app://${readiness.appId}` },
      {
        type: "text",
        text: `Use the mentioned Outlook Email app only as a transport. Send each message below exactly once to its exact recipient. Do not rewrite, summarize, add recipients, contact employers, or perform any other action.\n\n${JSON.stringify(exactMessages)}`,
      },
    ];
    const turnResult = await this.client.startTurn(this.currentRun.threadId, input, { cwd: this.workspaceRoot });
    const turnId = turnResult?.turn?.id;
    if (!turnId) throw new Error("Codex App Server did not return an Outlook transport turn identifier.");
    const completion = await this.#waitForTurnCompletion(turnId);
    const turnStatus = String(completion.turn?.status ?? "failed").toLowerCase();
    const calls = (this.#mcpToolCalls.get(turnId) ?? []).filter((item) => {
      const appName = String(item.appContext?.appName ?? "").toLowerCase();
      const tool = String(item.tool ?? "").toLowerCase();
      return appName.includes("outlook") || tool.includes("outlook") || tool.includes("send_email");
    });
    this.#mcpToolCalls.delete(turnId);
    this.#finalMessages.delete(turnId);
    return exactMessages.map((message, index) => {
      const call = calls[index];
      if (turnStatus !== "completed" || !call) return { status: turnStatus === "completed" ? "UNKNOWN" : "FAILED", providerReceipt: null };
      if (call.status === "completed" && !call.error) return { status: "SUBMITTED", providerReceipt: call.id ?? null };
      return { status: call.status === "failed" ? "FAILED" : "UNKNOWN", providerReceipt: call.id ?? null };
    });
  }

  async respondToApproval(approvalId, decision, answers = {}) {
    const pending = this.#pendingApprovals.get(approvalId);
    if (!pending) throw new Error(`Approval request ${approvalId} is no longer pending.`);
    const allowed = pending.publicView.availableDecisions;
    if (!allowed.includes(decision)) throw new TypeError(`Decision ${decision} is not available for this request.`);
    const result = pending.request.method === "item/tool/requestUserInput"
      ? decision === "respond" ? { answers: normalizeUserInputAnswers(answers, pending.publicView.questions) } : { answers: {} }
      : { decision };
    this.client.respondResult(pending.request.id, result);
    this.#pendingApprovals.delete(approvalId);
    await this.memoryStore.appendAction({
      runId: this.currentRun?.runId,
      actionType: "CODEX_APPROVAL_RESPONSE",
      approvalId,
      approvalMethod: pending.request.method,
      outcome: decision.toUpperCase(),
    });
    this.#publish({ type: "approval.resolved", approvalId, decision });
    return { approvalId, decision };
  }

  async close() {
    await this.client.close();
  }

  async #executeRun(run) {
    await this.memoryStore.setCurrentRun(this.snapshot());
    const readiness = await this.checkRuntimeReadiness();
    if (readiness.status !== "READY") {
      const error = new Error(readiness.detail);
      error.code = `CODEX_${readiness.status}`;
      throw error;
    }

    const state = await this.memoryStore.getState();
    const storedThreadId = state.runtime?.threadId;
    const threadResult = storedThreadId
      ? await this.client.resumeThread(storedThreadId, { cwd: this.workspaceRoot })
      : await this.client.startThread({ cwd: this.workspaceRoot });
    run.threadId = threadResult?.thread?.id;
    if (!run.threadId) throw new Error("Codex App Server did not return a thread identifier.");
    if (run.threadId !== storedThreadId) {
      await this.memoryStore.updateRuntimeState({ threadId: run.threadId });
    }

    const targetedUpdate = run.workflowType === "UPDATE";
    const pendingInput = buildPendingStudentInput(
      state.opportunities,
      targetedUpdate ? run.targetOpportunityId : null,
    );
    if (targetedUpdate && !pendingInput) {
      throw new Error("The saved student response for this opportunity is not available for the targeted update.");
    }
    const input = [
      {
        type: "text",
        text: targetedUpdate
          ? buildUpdateInstruction({ opportunityId: run.targetOpportunityId, opportunity: run.targetOpportunity })
          : COLLECT_INSTRUCTION,
      },
      {
        type: "skill",
        name: "job-fit-assessment",
        path: path.join(this.workspaceRoot, "agent", "skills", "job-fit-assessment", "SKILL.md"),
      },
      ...(pendingInput ? [{ type: "text", text: pendingInput }] : []),
      ...(pendingInput?.includes("REQUEST_APPLICATION_MATERIALS")
        ? [{
            type: "skill",
            name: "application-material-prep",
            path: path.join(this.workspaceRoot, "agent", "skills", "application-material-prep", "SKILL.md"),
          }]
        : []),
    ];
    const turnResult = await this.client.startTurn(
      run.threadId,
      input,
      { cwd: this.workspaceRoot },
    );
    run.turnId = turnResult?.turn?.id;
    if (!run.turnId) throw new Error("Codex App Server did not return a turn identifier.");
    await this.memoryStore.setCurrentRun(this.snapshot());

    const completion = await this.#waitForTurnCompletion(run.turnId);
    const turnStatus = String(completion.turn?.status ?? "failed").toLowerCase();
    if (turnStatus === "completed" && this.workflowCoordinator) {
      const finalMessage = this.#finalMessages.get(run.turnId);
      const integration = await this.workflowCoordinator.process({
        runId: run.runId,
        resultText: finalMessage,
        observedSearches: run.searchesPerformed,
        mode: targetedUpdate ? "TARGETED_UPDATE" : "DISCOVERY",
        targetOpportunityId: run.targetOpportunityId,
        onStage: (stage, detail) => this.#setBusinessStage(run, stage, detail),
      });
      Object.assign(run, integration.summary);
      run.selectedOpportunities = integration.selectedOpportunities;
      run.unresolvedIssueDetails = integration.unresolvedIssues;
      run.outcome = integration.outcome;
    } else {
      run.outcome = turnStatus === "completed" ? "SUCCESS" : turnStatus === "interrupted" ? "PARTIAL SUCCESS" : "FAILURE";
    }
    run.active = false;
    run.finishedAt = this.clock().toISOString();
    run.stage = run.outcome === "SUCCESS" ? "FINISHED" : "NEEDS_ATTENTION";
    run.label = run.outcome === "SUCCESS" ? "Finished" : "Action required";
    run.progressPercent = 100;
    run.statusDetail = completionDetail(run);
    if (run.outcome !== "SUCCESS" && !Number.isFinite(Number(run.unresolvedIssues))) run.unresolvedIssues = 1;
    this.#finalMessages.delete(run.turnId);
    await this.#finishRun(run);
  }

  async #failRun(run, error) {
    run.active = false;
    run.finishedAt = this.clock().toISOString();
    run.outcome = "FAILURE";
    run.stage = "NEEDS_ATTENTION";
    run.label = "Action required";
    run.unresolvedIssues += 1;
    run.error = {
      name: error?.name || "Error",
      code: safeDiagnosticCode(error?.code),
      message: safeRuntimeMessage(error?.message),
    };
    run.statusDetail = run.error.message || "The workflow stopped before it could finish. Review the issue and retry the same action.";
    if (run.workflowType === "UPDATE") await this.#markTargetUpdateFailed(run);
    await this.#finishRun(run);
  }

  async #markTargetUpdateFailed(run) {
    if (!run.targetOpportunityId || !run.responseId) return;
    const state = await this.memoryStore.getState();
    const prior = state.opportunities?.[run.targetOpportunityId]?.studentInput;
    if (!prior || prior.responseId !== run.responseId || ["REVIEWED", "NEEDS_MORE_INFORMATION"].includes(prior.status)) return;
    await this.memoryStore.upsertOpportunityState(run.targetOpportunityId, {
      studentInput: {
        ...prior,
        status: "UPDATE_FAILED",
        failedAt: this.clock().toISOString(),
        runId: run.runId,
        nextStep: "Your information is still saved. Select Update Opportunity to retry this targeted update.",
      },
    });
  }

  async #finishRun(run) {
    const publicRun = this.snapshot();
    await this.memoryStore.setCurrentRun(publicRun);
    await this.memoryStore.recordRunSummary({
      ...publicRun,
      candidatesDiscovered: publicRun.candidatesDiscovered ?? null,
      duplicatesOrInvalid: publicRun.duplicatesOrInvalid ?? null,
      candidatesRanked: publicRun.candidatesRanked ?? null,
      updatesSelected: publicRun.updatesSelected ?? null,
      newOpportunitiesAdded: publicRun.newOpportunitiesAdded ?? null,
      existingOpportunitiesUpdated: publicRun.existingOpportunitiesUpdated ?? null,
      notificationsSent: publicRun.notificationsSent ?? null,
      notificationPreviews: publicRun.notificationPreviews ?? null,
    });
    this.#publish({ type: "run.completed", run: publicRun });
  }

  #attachClientEvents() {
    this.client.on("notification", (message) => {
      const method = message.method;
      const params = message.params ?? {};
      if (method === "turn/completed" && params.turn?.id) {
        this.#completedTurns.set(params.turn.id, params);
        const waiter = this.#completionWaiters.get(params.turn.id);
        if (waiter) {
          this.#completionWaiters.delete(params.turn.id);
          waiter(params);
        }
      }
      if (method === "serverRequest/resolved" && params.requestId !== undefined) {
        const resolved = [...this.#pendingApprovals.entries()].find(
          ([, pending]) => String(pending.request.id) === String(params.requestId),
        );
        if (resolved) {
          this.#pendingApprovals.delete(resolved[0]);
          this.#publish({ type: "approval.resolved", approvalId: resolved[0], decision: "resolved" });
        }
      }
      if (
        ["item/started", "item/completed"].includes(method) &&
        params.item?.type === "webSearch" &&
        params.item?.action?.type === "search" &&
        this.currentRun?.active
      ) {
        const queries = params.item.action.queries;
        const observedCount = Array.isArray(queries) && queries.length > 0 ? queries.length : 1;
        const itemKey = String(params.item.id ?? params.item.callId ?? `${this.currentRun.turnId}:web-search`);
        const priorCount = this.#observedSearchCounts.get(itemKey) ?? 0;
        if (observedCount > priorCount) {
          this.currentRun.searchesPerformed += observedCount - priorCount;
          this.#observedSearchCounts.set(itemKey, observedCount);
        }
      }
      if (method === "item/completed" && params.item?.type === "agentMessage") {
        const turnId = params.turnId ?? this.currentRun?.turnId;
        if (turnId && (params.item.phase === "final_answer" || !params.item.phase)) {
          this.#finalMessages.set(turnId, params.item.text);
        }
      }
      if (method === "item/completed" && params.item?.type === "mcpToolCall") {
        const turnId = params.turnId ?? this.currentRun?.turnId;
        if (turnId) this.#mcpToolCalls.set(turnId, [...(this.#mcpToolCalls.get(turnId) ?? []), params.item]);
      }

      const publicEvent = method === "turn/completed" && this.workflowCoordinator ? null : publicRuntimeEvent(message);
      if (!publicEvent || !this.currentRun?.active) return;
      this.currentRun.stage = publicEvent.stage;
      this.currentRun.label = publicEvent.label;
      this.currentRun.statusDetail = publicEvent.detail;
      this.currentRun.progressPercent = Math.max(
        Number(this.currentRun.progressPercent) || 0,
        Number(publicEvent.progressPercent) || 0,
      );
      this.#publish({
        ...publicEvent,
        progressPercent: this.currentRun.progressPercent,
        runId: this.currentRun.runId,
      });
    });

    this.client.on("server-request", (request) => this.#handleServerRequest(request));
    this.client.on("process-error", (error) => {
      if (this.currentRun?.active) this.#publish({ type: "runtime.issue", detail: safeRuntimeMessage(error.message) });
    });
  }

  #handleServerRequest(request) {
    const supported = new Set(["item/commandExecution/requestApproval", "item/fileChange/requestApproval", "item/tool/requestUserInput"]);
    const isUserInput = request.method === "item/tool/requestUserInput";
    const questions = isUserInput ? publicQuestions(request.params?.questions) : [];
    const approvalId = this.idFactory();
    const publicView = {
      approvalId,
      method: request.method,
      title: isUserInput ? "Outlook needs your confirmation" : request.method.includes("fileChange") ? "Approve local file change" : "Approve local command",
      reason: isUserInput ? "Review the connector question before the workflow continues." : redactSensitiveText(request.params?.reason || "Codex requires approval to continue."),
      command: redactSensitiveValue(request.params?.command),
      cwd: request.params?.cwd || null,
      questions,
      availableDecisions: isUserInput ? ["respond", "cancel"] : supported.has(request.method) ? ["accept", "decline", "cancel"] : ["cancel"],
      supported: supported.has(request.method),
    };
    this.#pendingApprovals.set(approvalId, { request, publicView });
    if (this.currentRun?.active) {
      this.currentRun.stage = "NEEDS_ATTENTION";
      this.currentRun.label = "Approval required";
      this.currentRun.statusDetail = publicView.reason;
    }
    this.#publish({ type: "approval.requested", approval: publicView });
  }

  #waitForTurnCompletion(turnId) {
    if (this.#completedTurns.has(turnId)) return Promise.resolve(this.#completedTurns.get(turnId));
    return new Promise((resolve) => this.#completionWaiters.set(turnId, resolve));
  }

  #setBusinessStage(run, stage, detail) {
    const publicEvent = publicRuntimeEvent({ method: "internship/stage", params: { stage, detail } });
    if (!publicEvent) return;
    run.stage = publicEvent.stage;
    run.label = publicEvent.label;
    run.statusDetail = publicEvent.detail;
    run.progressPercent = Math.max(Number(run.progressPercent) || 0, Number(publicEvent.progressPercent) || 0);
    this.#publish({ ...publicEvent, progressPercent: run.progressPercent, runId: run.runId });
  }

  #publish(event) {
    this.emit("event", { ...event, timestamp: this.clock().toISOString() });
  }
}

function redactSensitiveText(value) {
  return String(value)
    .replace(/((?:api[_-]?key|password|token|secret|credential)\s*[:=]\s*)[^\s,;]+/gi, "$1[REDACTED]")
    .slice(0, 1_000);
}

function redactSensitiveValue(value) {
  if (Array.isArray(value)) return value.map((item) => redactSensitiveText(item));
  if (value === null || value === undefined) return null;
  return redactSensitiveText(value);
}

function safeDiagnosticCode(value) {
  if (value === null || value === undefined) return null;
  return String(value).replace(/[^A-Za-z0-9_-]/g, "").slice(0, 40) || null;
}

function safeRuntimeMessage(value) {
  const text = String(value || "The local Codex runtime could not complete the run.");
  if (/<!doctype|<html|<head|<style|<body/i.test(text)) {
    return "The local Codex runtime returned an unexpected web response.";
  }
  return redactSensitiveText(text)
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300);
}

function findOutlookApp(apps) {
  return apps.find((app) => /outlook.*email|microsoft.*outlook/i.test(`${app.name ?? ""} ${app.id ?? ""}`)) ?? null;
}

function outlookReadiness(status, detail, app = null) {
  return {
    status,
    label: status === "CONNECTED" ? "Outlook connected" : status === "DISABLED" ? "Outlook disabled" : status === "NOT_INSTALLED" ? "Outlook unavailable" : status === "NEEDS_CONNECTION" ? "Outlook needs connection" : status === "ACCESS_BLOCKED" ? "Outlook access unavailable" : "Outlook status unknown",
    detail,
    appId: app?.id ?? null,
    appName: app?.name ?? null,
  };
}

function outlookProbeFailure(errors) {
  const combined = errors.map((error) => `${error?.code ?? ""} ${error?.message ?? error ?? ""}`).join(" ");
  if (/\b403\b|forbidden/i.test(combined)) {
    return outlookReadiness(
      "ACCESS_BLOCKED",
      "Codex is signed in, but this App Server session is not permitted to list connected apps. Check the app or workspace controls in Codex, then restart the local application. No email was sent.",
    );
  }
  return outlookReadiness(
    "UNKNOWN",
    "The Outlook connection could not be checked in this Codex App Server session. Restart the local application, then try again. No email was sent.",
  );
}

function publicQuestions(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 3).map((question) => ({
    id: String(question.id ?? "").slice(0, 80),
    header: redactSensitiveText(question.header ?? "Confirmation"),
    question: redactSensitiveText(question.question ?? "Choose an option."),
    options: Array.isArray(question.options)
      ? question.options.slice(0, 5).map((option) => ({ label: redactSensitiveText(option.label), description: redactSensitiveText(option.description) }))
      : [],
    isOther: question.isOther === true,
  })).filter((question) => question.id);
}

function normalizeUserInputAnswers(value, questions) {
  const output = {};
  for (const question of questions ?? []) {
    const answer = value?.[question.id];
    const items = Array.isArray(answer) ? answer : answer ? [answer] : [];
    output[question.id] = { answers: items.map((item) => String(item).slice(0, 500)) };
  }
  return output;
}

function buildPendingStudentInput(opportunities = {}, targetOpportunityId = null) {
  const pending = Object.values(opportunities)
    .filter((entry) => !targetOpportunityId || String(entry?.opportunityId) === String(targetOpportunityId))
    .map((entry) => entry?.studentInput)
    .filter((entry) => ["READY_FOR_AGENT_REVIEW", "READY_FOR_UPDATE", "UPDATE_STARTING", "UPDATE_IN_PROGRESS", "UPDATE_FAILED"].includes(entry?.status))
    .slice(0, targetOpportunityId ? 1 : 20)
    .map((entry) => ({
      responseId: entry.responseId,
      opportunityId: entry.opportunityId,
      type: entry.type,
      response: entry.text || "",
      templateTypes: entry.templateTypes || [],
      submittedAt: entry.submittedAt,
    }));
  if (pending.length === 0) return "";
  return `Pending student-owned responses from local operational memory. Review only these structured facts; do not put identifying details into web searches. Resolve each response in studentInputResolution and prepare application templates only for REQUEST_APPLICATION_MATERIALS entries.\n${JSON.stringify(pending)}`;
}

function publicTargetOpportunity(opportunity = {}) {
  const allowed = [
    "opportunityId",
    "company",
    "roleTitle",
    "location",
    "workArrangement",
    "internshipPeriod",
    "deadline",
    "source",
    "postingUrl",
    "applicationUrl",
    "employerPostingId",
    "postingStatus",
    "dateDiscovered",
    "lastVerified",
    "fitAssessment",
    "agentDecision",
    "decisionRationale",
    "applicationStatus",
    "nextAction",
    "nextActionDate",
    "unresolvedIssue",
  ];
  return Object.fromEntries(allowed.map((key) => [key, opportunity?.[key] ?? ""]));
}

function completionDetail(run) {
  if (run.outcome !== "SUCCESS") {
    return run.unresolvedIssueDetails?.[0]
      || run.error?.message
      || "The workflow finished, but a specific item still requires review.";
  }
  if (run.workflowType === "UPDATE") {
    return `Your information was processed for ${run.targetLabel || "this opportunity"}. Review its updated next action below.`;
  }
  const selected = Number(run.updatesSelected) || 0;
  return `Collection finished. ${selected} relevant ${selected === 1 ? "opportunity was" : "opportunities were"} selected and processed.`;
}
