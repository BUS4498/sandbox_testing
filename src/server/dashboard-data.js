import { access, readFile } from "node:fs/promises";

export async function buildDashboardData({
  spreadsheetTracker,
  memoryStore,
  runManager,
  runtimePaths,
  notificationConfiguration = null,
  applicationMaterialStore = null,
  requestToken,
  clock = () => new Date(),
}) {
  const [records, state, runs, actions, evaluations, decisions, workbookAvailable, runtimeReadiness, notificationSettings, applicationMaterials] = await Promise.all([
    spreadsheetTracker.readRecords(),
    memoryStore.getState(),
    memoryStore.list("run", { limit: 10 }),
    memoryStore.list("action", { limit: 30 }),
    memoryStore.list("evaluation", { limit: 20 }),
    memoryStore.list("decision", { limit: 100 }),
    fileExists(runtimePaths.spreadsheet),
    readRuntimeReadiness(runManager, clock),
    readNotificationSettings(notificationConfiguration),
    typeof applicationMaterialStore?.listMaterials === "function" ? applicationMaterialStore.listMaterials() : [],
  ]);

  const latestRun = runs.at(-1) ?? null;
  const lastReset = await readJsonIfAvailable(runtimePaths.resetSummary);
  const latestNotification = [...actions]
    .reverse()
    .find((entry) => entry.actionType === "STUDENT_UPDATE_NOTIFICATION") ?? null;
  const currentRun = runManager.snapshot() ?? state.currentRun ?? latestRun;
  const today = clock();
  const decisionsByOpportunity = latestByOpportunity(decisions);
  const materialsByOpportunity = groupByOpportunity(applicationMaterials);
  const collection = records.map((record) => publicOpportunity(
    record,
    decisionsByOpportunity.get(record.opportunityId),
    state.opportunities?.[record.opportunityId]?.studentInput ?? null,
    materialsByOpportunity.get(record.opportunityId) ?? [],
  ));
  const attentionItems = collection.filter(opportunityNeedsUpdate).map(publicAttentionItem);

  return {
    application: {
      name: "Internship Application Prep Agent",
      localStatus: "Local only",
      requestToken,
    },
    runtime: runtimeReadiness,
    metrics: {
      totalTracked: records.length,
      newlyAdded: numericOrZero(latestRun?.newOpportunitiesAdded),
      prioritize: records.filter((record) => record.agentDecision === "PRIORITIZE").length,
      approachingDeadlines: records.filter((record) => isApproaching(record.deadline, today)).length,
      needsAttention: attentionItems.length,
      unresolvedIssues: records.filter((record) => Boolean(record.unresolvedIssue)).length,
    },
    attentionItems,
    collection,
    run: currentRun ? publicRun(currentRun, latestRun, today, runs.length <= 1) : null,
    selectedOpportunities: !currentRun?.active && Array.isArray(latestRun?.selectedOpportunities)
      ? latestRun.selectedOpportunities.map((record) => publicSelectedOpportunity(record, decisionsByOpportunity.get(record.opportunityId)))
      : [],
    sync: {
      status: workbookAvailable ? "AVAILABLE" : "NOT_CREATED",
      label: workbookAvailable ? "Local spreadsheet available" : "Spreadsheet not created yet",
      trackedOpportunities: records.length,
      lastSuccessfulUpdate: latestSuccessfulSpreadsheetAction(actions)?.timestamp ?? null,
      runtimeFolder: runtimePaths.root,
      spreadsheetPath: runtimePaths.spreadsheet,
      lastResetAt: lastReset?.resetAt ?? null,
      lastResetArchive: lastReset?.archivePath ?? null,
    },
    notificationSettings,
    notification: latestNotification
      ? {
          status: latestNotification.outcome,
          opportunityId: latestNotification.opportunityId,
          attemptedAt: latestNotification.attemptedAt ?? latestNotification.timestamp,
          recipientHint: latestNotification.recipientHint,
        }
      : null,
    automation: {
      status: state.runtime?.schedule?.status ?? "UNKNOWN",
      schedule: state.runtime?.schedule?.schedule ?? "Unknown",
      timezone: state.runtime?.schedule?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
      lastRun: state.runtime?.schedule?.lastRun ?? "Unknown",
      nextRun: state.runtime?.schedule?.nextRun ?? "Unknown",
      managedBy: "Codex",
      managementLocation: "Scheduled in the ChatGPT desktop app",
    },
    pendingApprovals: runManager.pendingApprovals,
    activity: buildActivity(actions, evaluations),
  };
}

function publicOpportunity(record, decision, studentInput, materials) {
  return {
    opportunityId: record.opportunityId,
    company: record.company,
    roleTitle: record.roleTitle,
    location: record.location,
    workArrangement: record.workArrangement,
    deadline: record.deadline,
    postingUrl: record.postingUrl || null,
    applicationUrl: record.applicationUrl || record.postingUrl || null,
    source: record.source || null,
    postingStatus: record.postingStatus,
    fitAssessment: record.fitAssessment,
    agentDecision: record.agentDecision,
    decisionRationale: record.decisionRationale || decision?.rationale || null,
    fitEvidence: normalizeFitEvidence(decision?.evidence),
    applicationStatus: record.applicationStatus,
    nextAction: record.nextAction,
    nextActionDate: record.nextActionDate,
    unresolvedIssue: record.unresolvedIssue,
    lastVerified: record.lastVerified,
    lastAgentReview: record.lastAgentReview,
    studentInput,
    materials,
  };
}

function publicSelectedOpportunity(record, decision) {
  return {
    opportunityId: record.opportunityId,
    company: record.company,
    roleTitle: record.roleTitle,
    location: record.location,
    workArrangement: record.workArrangement,
    deadline: record.deadline,
    postingUrl: record.postingUrl || null,
    applicationUrl: record.applicationUrl || record.postingUrl || null,
    source: record.source || null,
    updateDisposition: record.updateDisposition,
    selectionEvidence: record.selectionEvidence,
    fitAssessment: record.fitAssessment || decision?.fitAssessment || null,
    agentDecision: record.agentDecision || decision?.decision || null,
    decisionRationale: record.decisionRationale || decision?.rationale || null,
    fitEvidence: normalizeFitEvidence(record.fitEvidence || decision?.evidence),
    processingOutcome: record.processingOutcome,
    nextAction: record.nextAction || null,
    nextActionRequest: record.nextActionRequest || null,
    materials: Array.isArray(record.materials) ? record.materials : [],
  };
}

function publicRun(currentRun, latestRun, now, firstRun) {
  const sameRecordedRun = latestRun?.runId === currentRun.runId;
  const recorded = sameRecordedRun ? latestRun : null;
  return {
    runId: currentRun.runId,
    active: Boolean(currentRun.active),
    trigger: currentRun.trigger,
    workflowType: currentRun.workflowType ?? (currentRun.trigger === "OPPORTUNITY_UPDATE" ? "UPDATE" : "COLLECT"),
    targetOpportunityId: currentRun.targetOpportunityId ?? null,
    targetLabel: currentRun.targetLabel ?? null,
    stage: currentRun.stage,
    label: currentRun.label,
    statusDetail: currentRun.statusDetail ?? null,
    progressPercent: boundedProgress(currentRun.progressPercent, currentRun.active, currentRun.finishedAt),
    startedAt: currentRun.startedAt,
    finishedAt: currentRun.finishedAt,
    durationMs: durationMilliseconds(currentRun.startedAt, currentRun.finishedAt || now),
    firstRun,
    outcome: currentRun.outcome,
    error: currentRun.error ?? null,
    summary: {
      searchesPerformed: numberOrNull(currentRun.searchesPerformed ?? recorded?.searchesPerformed),
      candidatesDiscovered: numberOrNull(currentRun.candidatesDiscovered ?? recorded?.candidatesDiscovered),
      duplicatesOrInvalid: numberOrNull(currentRun.duplicatesOrInvalid ?? recorded?.duplicatesOrInvalid),
      candidatesRanked: numberOrNull(currentRun.candidatesRanked ?? recorded?.candidatesRanked),
      updatesSelected: numberOrNull(currentRun.updatesSelected ?? recorded?.updatesSelected),
      newOpportunitiesAdded: numberOrNull(currentRun.newOpportunitiesAdded ?? recorded?.newOpportunitiesAdded),
      existingOpportunitiesUpdated: numberOrNull(currentRun.existingOpportunitiesUpdated ?? recorded?.existingOpportunitiesUpdated),
      notificationsSent: numberOrNull(currentRun.notificationsSent ?? recorded?.notificationsSent),
      notificationPreviews: numberOrNull(currentRun.notificationPreviews ?? recorded?.notificationPreviews),
      unresolvedIssues: numberOrNull(currentRun.unresolvedIssues ?? recorded?.unresolvedIssues),
      selectionShortfallReason: currentRun.selectionShortfallReason ?? recorded?.selectionShortfallReason ?? null,
    },
  };
}

function opportunityNeedsUpdate(record) {
  const status = String(record.studentInput?.status ?? "").toUpperCase();
  return Boolean(record.unresolvedIssue)
    || ["READY_FOR_UPDATE", "UPDATE_FAILED", "NEEDS_MORE_INFORMATION"].includes(status);
}

function publicAttentionItem(record) {
  const status = String(record.studentInput?.status ?? "").toUpperCase();
  const prompt = status === "UPDATE_FAILED"
    ? record.studentInput?.nextStep
    : record.unresolvedIssue || record.studentInput?.nextStep || record.nextAction;
  return {
    opportunityId: record.opportunityId,
    company: record.company,
    roleTitle: record.roleTitle,
    prompt: prompt || "Review this opportunity and provide the requested update.",
    actionLabel: "Update Opportunity",
    updateStatus: status || null,
  };
}

function boundedProgress(value, active, finishedAt) {
  if (finishedAt && !active) return 100;
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(100, Math.round(number))) : 0;
}

function latestByOpportunity(entries) {
  const byOpportunity = new Map();
  for (const entry of entries) {
    if (entry.opportunityId) byOpportunity.set(entry.opportunityId, entry);
  }
  return byOpportunity;
}

function groupByOpportunity(entries) {
  const grouped = new Map();
  for (const entry of entries ?? []) {
    if (!entry.opportunityId) continue;
    grouped.set(entry.opportunityId, [...(grouped.get(entry.opportunityId) ?? []), entry]);
  }
  return grouped;
}

function normalizeFitEvidence(value) {
  const source = value && typeof value === "object" ? value : {};
  return {
    requiredMatches: stringArray(source.requiredMatches),
    preferredMatches: stringArray(source.preferredMatches),
    preferenceAlignment: stringArray(source.preferenceAlignment),
    gaps: stringArray(source.gaps),
    unknowns: stringArray(source.unknowns),
  };
}

function stringArray(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string" && item.trim()) : [];
}

function durationMilliseconds(start, end) {
  const startedAt = new Date(start).valueOf();
  const endedAt = end instanceof Date ? end.valueOf() : new Date(end).valueOf();
  if (!Number.isFinite(startedAt) || !Number.isFinite(endedAt) || endedAt < startedAt) return null;
  return endedAt - startedAt;
}

function buildActivity(actions, evaluations) {
  return [...actions.map(actionActivity), ...evaluations.map(evaluationActivity)]
    .sort((left, right) => String(right.timestamp).localeCompare(String(left.timestamp)))
    .slice(0, 12);
}

function actionActivity(entry) {
  return {
    id: entry.memoryId,
    timestamp: entry.timestamp,
    opportunityId: entry.opportunityId ?? null,
    kind: "ACTION",
    label: humanize(entry.actionType || "Action recorded"),
    outcome: entry.outcome ?? entry.status ?? "UNKNOWN",
    attentionRequired: ["FAILED", "UNKNOWN", "DECLINE", "CANCEL"].includes(String(entry.outcome).toUpperCase()),
  };
}

function evaluationActivity(entry) {
  return {
    id: entry.memoryId,
    timestamp: entry.timestamp,
    opportunityId: entry.opportunityId ?? null,
    kind: "EVALUATION",
    label: entry.observedOutcome || "Outcome evaluated",
    outcome: entry.outcome ?? "UNKNOWN",
    attentionRequired: Boolean(entry.unresolvedIssue) || entry.outcome !== "SUCCESS",
  };
}

function latestSuccessfulSpreadsheetAction(actions) {
  return [...actions]
    .reverse()
    .find(
      (entry) =>
        /SPREADSHEET/.test(String(entry.actionType)) &&
        ["SUCCESS", "COMPLETED"].includes(String(entry.outcome ?? entry.status).toUpperCase()),
    );
}

function isApproaching(value, today) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value ?? ""))) return false;
  const deadline = new Date(`${value}T12:00:00Z`);
  const current = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 12));
  const days = (deadline - current) / 86_400_000;
  return days >= 0 && days <= 14;
}

function numberOrNull(value) {
  return Number.isFinite(Number(value)) ? Number(value) : null;
}

function numericOrZero(value) {
  return numberOrNull(value) ?? 0;
}

function humanize(value) {
  return String(value).toLowerCase().replace(/_/g, " ").replace(/^./, (letter) => letter.toUpperCase());
}

async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readJsonIfAvailable(filePath) {
  if (!filePath) return null;
  try { return JSON.parse(await readFile(filePath, "utf8")); } catch { return null; }
}

async function readRuntimeReadiness(runManager, clock) {
  if (typeof runManager.checkRuntimeReadiness === "function") {
    try {
      return await runManager.checkRuntimeReadiness();
    } catch {
      return {
        status: "UNAVAILABLE",
        label: "Codex unavailable",
        detail: "The local Codex readiness check failed. Restart the local application, then recheck.",
        authentication: "Unknown",
        checkedAt: clock().toISOString(),
        diagnosticCode: "READINESS_CHECK_FAILED",
      };
    }
  }
  return {
    status: "UNKNOWN",
    label: "Codex readiness unknown",
    detail: "This controller does not expose a runtime readiness check.",
    authentication: "Unknown",
    checkedAt: clock().toISOString(),
    diagnosticCode: null,
  };
}

async function readNotificationSettings(notificationConfiguration) {
  if (typeof notificationConfiguration?.snapshot === "function") {
    try {
      return await notificationConfiguration.snapshot();
    } catch {
      return {
        configured: false,
        recipientHint: null,
        mode: "OUTLOOK",
        deliveryStatus: "UNKNOWN",
        outlook: {
          status: "UNKNOWN",
          label: "Outlook check failed",
          detail: "The Outlook connection could not be checked. Restart the local application, then try again.",
          appId: null,
          appName: null,
        },
        explanation: "The Outlook connection could not be checked. No email was sent.",
      };
    }
  }
  return {
    configured: false,
    recipientHint: null,
    mode: "DRY_RUN",
    deliveryStatus: "LOCAL_PREVIEW_ONLY",
    explanation: "Add a student email address to create local notification previews.",
  };
}
