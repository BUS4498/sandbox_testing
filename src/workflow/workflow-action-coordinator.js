import { DuplicateOpportunityError, AmbiguousDuplicateError } from "../persistence/spreadsheet-tracker.js";
import { parseAndValidateWorkflowResult } from "./workflow-result-contract.js";

const AGENT_WRITABLE_FIELDS = new Set([
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
  "fitAssessment",
  "agentDecision",
  "decisionRationale",
  "nextAction",
  "nextActionDate",
  "unresolvedIssue",
  "lastVerified",
  "lastAgentReview",
]);

export class WorkflowActionCoordinator {
  constructor({ spreadsheetTracker, memoryStore, notifier = null, applicationMaterialStore = null, clock = () => new Date() }) {
    if (!spreadsheetTracker || !memoryStore) {
      throw new TypeError("WorkflowActionCoordinator requires spreadsheet and memory helpers.");
    }
    this.spreadsheetTracker = spreadsheetTracker;
    this.memoryStore = memoryStore;
    this.notifier = notifier;
    this.applicationMaterialStore = applicationMaterialStore;
    this.clock = clock;
  }

  setNotifier(notifier) {
    if (notifier !== null && typeof notifier?.notifyMaterialUpdate !== "function") {
      throw new TypeError("A notification helper must provide notifyMaterialUpdate.");
    }
    this.notifier = notifier;
  }

  async process({ runId, resultText, observedSearches, mode = "DISCOVERY", targetOpportunityId, onStage = () => {} }) {
    const result = parseAndValidateWorkflowResult(resultText, { observedSearches, mode, targetOpportunityId });
    const selectedOutcomes = [];
    const unresolved = [...result.unresolvedIssues];
    let newOpportunitiesAdded = 0;
    let existingOpportunitiesUpdated = 0;
    let duplicatesIgnored = 0;
    let notificationsSent = 0;
    let notificationPreviews = 0;
    const notificationWork = [];

    onStage("UPDATING_COLLECTION", "Applying permitted material updates to the local collection.");
    for (const selection of result.selectedOpportunities) {
      const processed = await this.#processSelection({ runId, selection, unresolved });
      selectedOutcomes.push(processed.publicOutcome);
      if (processed.collectionOutcome === "ADDED") newOpportunitiesAdded += 1;
      if (processed.collectionOutcome === "UPDATED") existingOpportunitiesUpdated += 1;
      if (processed.collectionOutcome === "DUPLICATE_IGNORED") duplicatesIgnored += 1;

      await this.#applyStudentInputResolution({ runId, selection, processed });
      await this.#saveApplicationMaterials({ runId, selection, processed, unresolved });

      if (!processed.materialUpdate) continue;
      notificationWork.push({ selection, processed });
    }

    if (notificationWork.length > 0) {
      onStage("SENDING_NOTIFICATIONS", "Submitting permitted informational updates through the configured student notification channel.");
      const notifications = await this.#notifyBatchSafely({ runId, work: notificationWork, unresolved });
      notifications.forEach((notification, index) => {
        const processed = notificationWork[index].processed;
        processed.publicOutcome.notificationStatus = notification.status;
        if (["SUBMITTED", "DELIVERED"].includes(notification.status)) notificationsSent += 1;
        if (notification.status === "DRY_RUN") notificationPreviews += 1;
        if (["FAILED", "UNKNOWN", "BLOCKED_RUN_LIMIT", "NOT_CONFIGURED"].includes(notification.status)) {
          const issue = notification.issue || `Student notification was not confirmed for ${processed.record.company} — ${processed.record.roleTitle}.`;
          if (!unresolved.includes(issue)) unresolved.push(issue);
          processed.publicOutcome.processingOutcome = "PARTIAL SUCCESS";
          processed.publicOutcome.unresolvedIssue = issue;
        }
      });
    }

    onStage("VERIFYING", "Reconciling spreadsheet, notification, and duplicate-prevention outcomes.");
    const failed = selectedOutcomes.filter((item) => item.processingOutcome === "FAILURE").length;
    onStage("REMEMBERING", "Saving the verified run summary and unresolved next actions.");

    const summary = {
      ...result.runSummary,
      updatesSelected: result.selectedOpportunities.length,
      newOpportunitiesAdded,
      existingOpportunitiesUpdated,
      duplicatesOrInvalid: Math.min(
        result.runSummary.candidatesDiscovered,
        result.runSummary.duplicatesOrInvalid + duplicatesIgnored,
      ),
      notificationsSent,
      notificationPreviews,
      unresolvedIssues: unresolved.length,
      selectionShortfallReason: result.runSummary.selectionShortfallReason,
    };
    const outcome = failed === result.selectedOpportunities.length && failed > 0
      ? "FAILURE"
      : unresolved.length > 0 || failed > 0
        ? "PARTIAL SUCCESS"
        : "SUCCESS";

    return { outcome, summary, selectedOpportunities: selectedOutcomes, unresolvedIssues: unresolved };
  }

  async #processSelection({ runId, selection, unresolved }) {
    const baseRecord = selectionToRecord(selection, this.clock());
    let collectionResult;
    let disposition = selection.updateDisposition;

    try {
      if (selection.updateDisposition === "NEW") {
        const duplicate = await this.spreadsheetTracker.checkDuplicate(baseRecord);
        if (duplicate.classification === "POSSIBLE") {
          const issue = `Possible duplicate requires student review: ${baseRecord.company} — ${baseRecord.roleTitle}.`;
          unresolved.push(issue);
          await this.#rememberNoWrite(runId, selection, "POSSIBLE_DUPLICATE", issue);
          return outcome(selection, "NEEDS_ATTENTION", "POSSIBLE_DUPLICATE", false, null, issue);
        }
        if (duplicate.classification === "EXACT" && duplicate.changedFields.length === 0) {
          await this.#rememberNoWrite(runId, selection, "DUPLICATE_IGNORED", "Known opportunity was unchanged.");
          return outcome(selection, "SUCCESS", "DUPLICATE_IGNORED", false, duplicate.opportunityId);
        }
        if (duplicate.classification === "EXACT") {
          disposition = "MATERIALLY_CHANGED";
          collectionResult = await this.#updateExisting(runId, selection, baseRecord, duplicate.opportunityId);
        } else {
          collectionResult = await this.spreadsheetTracker.addOpportunity(baseRecord);
        }
      } else {
        collectionResult = await this.#updateExisting(runId, selection, baseRecord, selection.existingOpportunityId);
      }

      const record = collectionResult.record;
      const collectionOutcome = disposition === "NEW" ? "ADDED" : collectionResult.materialChange === false ? "DUPLICATE_IGNORED" : "UPDATED";
      const materialUpdate = collectionOutcome === "ADDED" || collectionOutcome === "UPDATED";
      await this.#rememberVerifiedUpdate({ runId, selection, record, collectionResult, collectionOutcome });
      const result = outcome(selection, "SUCCESS", collectionOutcome, materialUpdate, record.opportunityId, null, {
        record,
        verification: collectionResult.verification,
        changedFields: collectionResult.changedFields ?? Object.keys(baseRecord),
        disposition,
      });
      result.publicOutcome.updateDisposition = disposition;
      return result;
    } catch (error) {
      const issue = `Collection update failed for ${baseRecord.company} — ${baseRecord.roleTitle}: ${safeError(error)}.`;
      unresolved.push(issue);
      await this.memoryStore.appendEvaluation({
        runId,
        opportunityId: selection.existingOpportunityId || baseRecord.opportunityId || null,
        expectedOutcome: "Record one distinct current opportunity and verify the write.",
        observedOutcome: "The local collection update could not be verified.",
        outcome: "FAILURE",
        unresolvedIssue: issue,
        recommendedCorrectiveAction: "Review the local spreadsheet status and retry with the same opportunity identifiers.",
      });
      return outcome(selection, "FAILURE", "FAILED", false, selection.existingOpportunityId, issue);
    }
  }

  async #updateExisting(runId, selection, baseRecord, opportunityId) {
    const existing = await this.spreadsheetTracker.getOpportunity(opportunityId);
    if (!existing) throw new Error(`existing opportunity ${opportunityId} was not found`);
    const changes = Object.fromEntries(
      Object.entries(baseRecord).filter(([key, value]) => AGENT_WRITABLE_FIELDS.has(key) && value !== ""),
    );
    return this.spreadsheetTracker.updateOpportunity(opportunityId, changes, {
      actor: "AGENT",
      expectedVersion: existing.recordVersion,
    });
  }

  async #rememberVerifiedUpdate({ runId, selection, record, collectionResult, collectionOutcome }) {
    const verification = collectionResult.verification;
    await this.memoryStore.appendDecision({
      runId,
      opportunityId: record.opportunityId,
      decision: selection.agentDecision,
      rationale: selection.decisionRationale,
      evidence: selection.fitEvidence,
      fitAssessment: selection.fitAssessment,
    });
    await this.memoryStore.appendAction({
      runId,
      opportunityId: record.opportunityId,
      actionType: collectionOutcome === "ADDED" ? "SPREADSHEET_ROW_ADDED" : collectionOutcome === "UPDATED" ? "SPREADSHEET_ROW_UPDATED" : "SPREADSHEET_UNCHANGED",
      idempotencyKey: `spreadsheet:${record.opportunityId}:v${record.recordVersion}`,
      outcome: verification?.success ? "SUCCESS" : "FAILURE",
      recordVersion: record.recordVersion,
    });
    await this.memoryStore.appendObservation({
      runId,
      opportunityId: record.opportunityId,
      observationType: verification?.success ? "SPREADSHEET_UPDATE_CONFIRMED" : "SPREADSHEET_UPDATE_UNCONFIRMED",
      changedFields: collectionResult.changedFields ?? [],
      postingStatus: record.postingStatus,
      sourceUrl: record.postingUrl,
    });
    await this.memoryStore.appendEvaluation({
      runId,
      opportunityId: record.opportunityId,
      expectedOutcome: "Write one current opportunity row with no unintended duplicate.",
      observedOutcome: verification?.success ? "The intended record passed spreadsheet read-back verification." : "The intended record did not pass read-back verification.",
      outcome: verification?.success ? "SUCCESS" : "FAILURE",
      unresolvedIssue: verification?.success ? null : "Spreadsheet verification failed.",
      recommendedCorrectiveAction: verification?.success ? null : "Inspect the local workbook before retrying.",
    });
    await this.memoryStore.upsertOpportunityState(record.opportunityId, {
      postingStatus: record.postingStatus,
      deadline: record.deadline,
      recommendation: record.agentDecision,
      nextAction: record.nextAction,
      unresolvedIssue: record.unresolvedIssue,
      spreadsheetRecordVersion: record.recordVersion,
    });
  }

  async #rememberNoWrite(runId, selection, observationType, detail) {
    await this.memoryStore.appendObservation({
      runId,
      opportunityId: selection.existingOpportunityId || selection.opportunity.opportunityId || null,
      observationType,
      company: selection.opportunity.company,
      roleTitle: selection.opportunity.roleTitle,
      sourceUrl: selection.opportunity.postingUrl,
      detail,
    });
    await this.memoryStore.appendEvaluation({
      runId,
      opportunityId: selection.existingOpportunityId || selection.opportunity.opportunityId || null,
      expectedOutcome: "Avoid duplicate rows and duplicate notifications.",
      observedOutcome: detail,
      outcome: observationType === "DUPLICATE_IGNORED" ? "SUCCESS" : "PARTIAL SUCCESS",
      unresolvedIssue: observationType === "DUPLICATE_IGNORED" ? null : detail,
      recommendedCorrectiveAction: observationType === "DUPLICATE_IGNORED" ? null : "Ask the student to resolve the possible duplicate.",
    });
  }

  async #notify({ runId, selection, processed, unresolved }) {
    if (!this.notifier) {
      const issue = `Student notification is not configured for ${processed.record.company} — ${processed.record.roleTitle}.`;
      unresolved.push(issue);
      await this.memoryStore.appendAction({
        runId,
        opportunityId: processed.record.opportunityId,
        actionType: "STUDENT_UPDATE_NOTIFICATION",
        idempotencyKey: `email:${runId}:${processed.record.opportunityId}:v${processed.record.recordVersion}`,
        outcome: "NOT_CONFIGURED",
      });
      await this.memoryStore.appendEvaluation({
        runId,
        opportunityId: processed.record.opportunityId,
        expectedOutcome: "Send one informational update after a verified material spreadsheet change.",
        observedOutcome: "No student notification address or provider-safe preview configuration was available.",
        outcome: "PARTIAL SUCCESS",
        unresolvedIssue: issue,
        recommendedCorrectiveAction: "Configure the local student notification address and retry idempotently.",
      });
      return { status: "NOT_CONFIGURED", issue };
    }

    return this.notifier.notifyMaterialUpdate(this.#notificationInput({ runId, selection, processed }));
  }

  #notificationInput({ runId, selection, processed }) {
    const record = processed.record;
    const changed = processed.changedFields ?? selection.whatChanged;
    const updateType = processed.disposition === "NEW"
      ? "NEW_OPPORTUNITY"
      : changed.some((field) => /deadline|postingStatus/i.test(field))
        ? "DEADLINE_STATUS_CHANGE"
        : selection.unresolvedIssue
          ? "UNRESOLVED_ISSUE"
          : "EXISTING_OPPORTUNITY_UPDATE";
    return {
      runId,
      opportunityId: record.opportunityId,
      materialUpdateId: `${record.opportunityId}:v${record.recordVersion}`,
      idempotencyKey: `email:${runId}:${record.opportunityId}:v${record.recordVersion}`,
      spreadsheetVerification: processed.verification,
      materialChange: true,
      updateDisposition: processed.disposition === "NEW" ? "NEW" : "MATERIALLY_CHANGED",
      candidateClassification: record.postingStatus,
      updateType,
      company: record.company,
      roleTitle: record.roleTitle,
      whatChanged: selection.whatChanged.join("; ") || (processed.disposition === "NEW" ? "A new verified opportunity was added." : "A material opportunity update was recorded."),
      deadline: record.deadline,
      agentDecision: selection.agentDecision,
      rationale: selection.decisionRationale,
      nextAction: selection.nextAction,
      attentionRequired: selection.attentionRequired,
    };
  }

  async #notifyBatchSafely({ runId, work, unresolved }) {
    if (!this.notifier || typeof this.notifier.notifyMaterialUpdates !== "function") {
      const results = [];
      for (const item of work) results.push(await this.#notifySafely({ runId, ...item, unresolved }));
      return results;
    }
    try {
      return await this.notifier.notifyMaterialUpdates(work.map((item) => this.#notificationInput({ runId, ...item })));
    } catch (error) {
      const results = [];
      for (const item of work) results.push(await this.#rememberNotificationFailure({ runId, ...item, unresolved, error }));
      return results;
    }
  }

  async #notifySafely({ runId, selection, processed, unresolved }) {
    try {
      return await this.#notify({ runId, selection, processed, unresolved });
    } catch (error) {
      return this.#rememberNotificationFailure({ runId, processed, unresolved, error });
    }
  }

  async #rememberNotificationFailure({ runId, processed, unresolved, error }) {
      const issue = `Student notification failed for ${processed.record.company} — ${processed.record.roleTitle}: ${safeError(error)}.`;
      if (!unresolved.includes(issue)) unresolved.push(issue);
      await this.memoryStore.appendAction({
        runId,
        opportunityId: processed.record.opportunityId,
        actionType: "STUDENT_UPDATE_NOTIFICATION",
        idempotencyKey: `email:${runId}:${processed.record.opportunityId}:v${processed.record.recordVersion}`,
        outcome: "FAILED",
      });
      await this.memoryStore.appendEvaluation({
        runId,
        opportunityId: processed.record.opportunityId,
        expectedOutcome: "Create or send one informational update after a verified material spreadsheet change.",
        observedOutcome: "The notification helper failed after the collection update succeeded.",
        outcome: "FAILURE",
        unresolvedIssue: issue,
        recommendedCorrectiveAction: "Review local notification configuration and retry idempotently without repeating the spreadsheet update.",
      });
      return { status: "FAILED", issue };
  }

  async #applyStudentInputResolution({ runId, selection, processed }) {
    const resolution = selection.studentInputResolution;
    if (!resolution || !processed.record?.opportunityId) return;
    const state = await this.memoryStore.getState();
    const prior = state.opportunities?.[processed.record.opportunityId]?.studentInput;
    if (!prior || prior.responseId !== resolution.responseId) return;
    await this.memoryStore.upsertOpportunityState(processed.record.opportunityId, {
      studentInput: {
        ...prior,
        status: resolution.status,
        reviewedAt: this.clock().toISOString(),
        outcome: resolution.outcome,
        nextStep: resolution.nextStep,
      },
    });
    await this.memoryStore.appendObservation({
      runId,
      opportunityId: processed.record.opportunityId,
      observationType: "STUDENT_RESPONSE_REVIEWED",
      responseId: resolution.responseId,
      outcome: resolution.status,
    });
  }

  async #saveApplicationMaterials({ runId, selection, processed, unresolved }) {
    const prep = selection.applicationPrep;
    processed.publicOutcome.materials = [];
    if (prep?.status !== "PREPARED" || prep.templates.length === 0 || !processed.record) return;
    if (!this.applicationMaterialStore) {
      const issue = `Application-template storage is unavailable for ${processed.record.company} — ${processed.record.roleTitle}.`;
      unresolved.push(issue);
      processed.publicOutcome.processingOutcome = "PARTIAL SUCCESS";
      processed.publicOutcome.unresolvedIssue = issue;
      return;
    }
    for (const template of prep.templates) {
      try {
        const saved = await this.applicationMaterialStore.saveTemplate({
          runId,
          opportunityId: processed.record.opportunityId,
          company: processed.record.company,
          roleTitle: processed.record.roleTitle,
          ...template,
        });
        processed.publicOutcome.materials.push(saved);
        await this.memoryStore.appendAction({
          runId,
          opportunityId: processed.record.opportunityId,
          actionType: "APPLICATION_TEMPLATE_SAVED",
          materialId: saved.materialId,
          templateType: saved.type,
          outcome: saved.verified ? "SUCCESS" : "FAILURE",
        });
        await this.memoryStore.appendEvaluation({
          runId,
          opportunityId: processed.record.opportunityId,
          expectedOutcome: "Save a review-only application template locally with a draft label.",
          observedOutcome: saved.verified ? "The draft template was saved and its review label was verified." : "The saved template could not be verified.",
          outcome: saved.verified ? "SUCCESS" : "FAILURE",
          unresolvedIssue: saved.verified ? null : "Application-template verification failed.",
        });
      } catch (error) {
        const issue = `Application-template preparation failed for ${processed.record.company} — ${processed.record.roleTitle}: ${safeError(error)}.`;
        unresolved.push(issue);
        processed.publicOutcome.processingOutcome = "PARTIAL SUCCESS";
        processed.publicOutcome.unresolvedIssue = issue;
      }
    }
  }
}

function selectionToRecord(selection, now) {
  const date = now.toISOString().slice(0, 10);
  return {
    ...selection.opportunity,
    fitAssessment: selection.fitAssessment,
    agentDecision: selection.agentDecision,
    decisionRationale: selection.decisionRationale,
    nextAction: selection.nextAction,
    nextActionDate: selection.nextActionDate,
    unresolvedIssue: selection.unresolvedIssue,
    lastVerified: selection.opportunity.lastVerified || date,
    lastAgentReview: date,
  };
}

function outcome(selection, processingOutcome, collectionOutcome, materialUpdate, opportunityId, unresolvedIssue = null, privateData = {}) {
  const publicOutcome = {
    opportunityId: opportunityId || selection.opportunity.opportunityId || null,
    company: selection.opportunity.company,
    roleTitle: selection.opportunity.roleTitle,
    location: selection.opportunity.location,
    workArrangement: selection.opportunity.workArrangement,
    deadline: selection.opportunity.deadline,
    postingUrl: selection.opportunity.postingUrl,
    applicationUrl: selection.opportunity.applicationUrl,
    source: selection.opportunity.source,
    updateDisposition: selection.updateDisposition,
    selectionEvidence: selection.selectionEvidence.join("; "),
    fitAssessment: selection.fitAssessment,
    agentDecision: selection.agentDecision,
    decisionRationale: selection.decisionRationale,
    fitEvidence: selection.fitEvidence,
    nextAction: selection.nextAction,
    nextActionRequest: selection.nextActionRequest,
    processingOutcome,
    collectionOutcome,
    notificationStatus: materialUpdate ? "PENDING" : "NOT_APPLICABLE",
    unresolvedIssue,
  };
  return { publicOutcome, collectionOutcome, materialUpdate, ...privateData };
}

function safeError(error) {
  if (error instanceof DuplicateOpportunityError) return "an exact duplicate was detected";
  if (error instanceof AmbiguousDuplicateError) return "a possible duplicate requires review";
  return String(error?.message || "unknown local error")
    .replace(/((?:api[_-]?key|password|token|secret|credential)\s*[:=]\s*)[^\s,;]+/gi, "$1[REDACTED]")
    .slice(0, 240);
}
