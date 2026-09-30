import { scoreSavedOpportunity } from "./jev";
import { runTargetedAssessment } from "./openai";
import { targetedUpdatePrompt } from "./prompt";
import { applyTargetedAssessment } from "./targeted-assessment-application.js";
import { assessmentMatchesSetup } from "./opportunity-state.js";
import {
  appendEvent, completeStudentResponse, finishRun, getOpportunity, getStudentResponse,
  getStudentSetup, markStudentResponsePending, saveOpportunity, startRun, updateRun,
  type OpportunityRecord, type RunRecord, type StudentResponse, type StudentSetup,
} from "./store";

async function stage(ownerId: string, run: RunRecord, name: string, detail: string, progress: number) {
  run.stage = name; run.detail = detail; run.progress = progress;
  await updateRun(ownerId, run);
}

function deterministicRecord(current: OpportunityRecord, response: StudentResponse, setup: StudentSetup): OpportunityRecord {
  const now = new Date().toISOString();
  const assessmentProfileConfirmedAt = assessmentMatchesSetup(current, setup) ? setup.confirmedAt : null;
  if (response.responseType === "NOT_INTERESTED") {
    return { ...current, recordVersion: current.recordVersion + 1, lastUpdated: now, lastAgentReview: now, assessmentProfileConfirmedAt,
      agentDecision: "ARCHIVE", decisionRationale: "The student explicitly chose not to pursue this opportunity.",
      nextAction: "No further preparation is needed unless you decide to revisit this opportunity.",
      nextActionRequest: { prompt: "", responseType: "", options: [], whatHappensNext: "" },
      unresolvedIssue: "", attentionRequired: false, applicationStatus: "NOT_INTERESTED", lastProcessedResponseId: response.id };
  }
  return { ...current, recordVersion: current.recordVersion + 1, lastUpdated: now, lastAgentReview: now, assessmentProfileConfirmedAt,
    nextAction: "Return to the question when you have the information; this opportunity remains under review.",
    unresolvedIssue: current.nextActionRequest?.prompt || current.unresolvedIssue || "The student cannot answer the current question yet.",
    attentionRequired: true, lastProcessedResponseId: response.id };
}

export async function processTargetedResponse(ownerId: string, responseId: string): Promise<RunRecord> {
  const response = await getStudentResponse(ownerId, responseId);
  if (!response) throw new TypeError("The saved response was not found.");
  if (response.status === "COMPLETE") throw new TypeError("This response has already been processed. Review the updated opportunity.");
  const setup = await getStudentSetup(ownerId);
  if (!setup.ready) throw new TypeError("Select and confirm a student setup before retrying this update.");
  const run = await startRun(ownerId, "TARGETED_UPDATE");
  const summary: Record<string, unknown> = { runKind: "TARGETED_UPDATE", opportunityId: response.opportunityId, responseId, searchesPerformed: 0, outcome: "PENDING" };
  let scoreRequired = false;
  try {
    const current = await getOpportunity(ownerId, response.opportunityId);
    if (!current) throw new TypeError("The selected opportunity is no longer in your collection.");
    await appendEvent(ownerId, run.id, response.opportunityId, "RETRIEVE", { responseId, opportunityVersion: current.recordVersion, profileMode: setup.mode, discoverySearches: 0 });
    if (current.lastProcessedResponseId === response.id) {
      await completeStudentResponse(ownerId, response.id);
      summary.outcome = "ALREADY_APPLIED";
    } else {
      let updated: OpportunityRecord;
      if (response.responseType === "NOT_INTERESTED" || response.responseType === "UNKNOWN") {
        await stage(ownerId, run, "REASON_DECIDE", `Applying your ${response.responseType === "NOT_INTERESTED" ? "not interested" : "not sure yet"} choice to this opportunity without a model call.`, 50);
        updated = deterministicRecord(current, response, setup);
      } else {
        if (!assessmentMatchesSetup(current, setup)) throw new TypeError("This opportunity was assessed before the current student setup. Reassess it before updating.");
        await stage(ownerId, run, "REASON_DECIDE", `Asking OpenAI to reassess your answer against the saved opportunity and confirmed profile, without web search. Jev scores updated evidence when it is sufficient.`, 45);
        const proposal = await runTargetedAssessment(targetedUpdatePrompt(current, response, setup, new Date().toISOString().slice(0, 10)), {
          opportunityId: current.opportunityId, responseId: response.id,
          gapCount: current.fitEvidence.gaps.length, unknownCount: current.fitEvidence.unknowns.length,
        });
        const now = new Date().toISOString();
        updated = applyTargetedAssessment(current, response, proposal, setup, now);
        scoreRequired = true;
        summary.outcome = proposal.resolution;
        summary.responseExplanation = proposal.responseExplanation;
      }
      await stage(ownerId, run, "ACT", `Saving the new recommendation and your answer for ${current.company} — ${current.roleTitle}.`, 72);
      await saveOpportunity(ownerId, updated, current.recordVersion);
      await appendEvent(ownerId, run.id, current.opportunityId, "DECISION", { responseId, decision: updated.agentDecision, rationale: updated.decisionRationale });
      await appendEvent(ownerId, run.id, current.opportunityId, "ACTION", { responseId, action: "TARGETED_OPPORTUNITY_UPDATED", recordVersion: updated.recordVersion, email: "NOT_TRIGGERED_BY_STUDENT_RESPONSE" });
      if (scoreRequired) {
        await stage(ownerId, run, "REASON", "The OpenAI recommendation is saved. Checking the updated evidence for its Jev score.", 82);
        try {
          const score = await scoreSavedOpportunity(ownerId, current.opportunityId, setup, run.id);
          summary.fitScore = { status: score.status, reason: score.reason, providerCalled: score.called };
        } catch {
          summary.fitScore = { status: "UNAVAILABLE", reason: "Jev scoring failed; the OpenAI assessment remains saved. Use Score existing matches to retry." };
          await appendEvent(ownerId, run.id, current.opportunityId, "EVALUATION", { expected: "Required evidence-ready preliminary fit score", observed: "Scoring unavailable", outcome: "PARTIAL SUCCESS" }).catch(() => undefined);
        }
      }
      if (summary.outcome === "PENDING") summary.outcome = response.responseType === "NOT_INTERESTED" ? "ARCHIVED_BY_STUDENT" : "AWAITING_INFORMATION";
      await completeStudentResponse(ownerId, response.id);
    }
    await stage(ownerId, run, "VERIFY", "Checking the saved response and the same opportunity record; no other opportunity or search was processed.", 90);
    const [verifiedRecord, verifiedResponse] = await Promise.all([getOpportunity(ownerId, response.opportunityId), getStudentResponse(ownerId, response.id)]);
    if (!verifiedRecord || verifiedRecord.lastProcessedResponseId !== response.id || verifiedResponse?.status !== "COMPLETE") {
      throw new Error("The targeted update could not be verified.");
    }
    await appendEvent(ownerId, run.id, response.opportunityId, "EVALUATION", { responseId, expected: "One saved response and one current opportunity", observed: "Response complete and same opportunity read-back verified", outcome: "SUCCESS", discoverySearches: 0 });
    await appendEvent(ownerId, run.id, response.opportunityId, "REMEMBER", { responseId, recordVersion: verifiedRecord.recordVersion, nextAction: verifiedRecord.nextAction });
    const scoreStatus = (summary.fitScore as { status?: string } | undefined)?.status;
    run.status = scoreRequired && scoreStatus !== "SCORED" ? "PARTIAL_SUCCESS" : "SUCCESS"; run.stage = "FINISHED"; run.progress = 100;
    run.detail = `Updated ${verifiedRecord.company} — ${verifiedRecord.roleTitle}. ${scoreRequired && scoreStatus !== "SCORED" ? "Jev score remains unavailable; use Score existing matches to retry when the issue is resolved." : verifiedRecord.unresolvedIssue ? "A specific issue still needs attention." : "The saved answer has been processed."} No web search or email was used.`;
    run.finishedAt = new Date().toISOString(); run.summary = summary;
    await finishRun(ownerId, run);
    return run;
  } catch (error) {
    const code = "TARGETED_UPDATE_FAILURE";
    await markStudentResponsePending(ownerId, response.id, code).catch(() => undefined);
    run.status = "FAILURE"; run.stage = "ACTION_REQUIRED"; run.progress = 100;
    run.detail = error instanceof Error ? error.message : "The update could not be verified. Your answer is saved for review on this opportunity.";
    run.errorCode = code; run.finishedAt = new Date().toISOString();
    summary.outcome = "PENDING_RETRY"; run.summary = summary;
    try { await appendEvent(ownerId, run.id, response.opportunityId, "EVALUATION", { responseId, expected: "Verified targeted update", observed: code, outcome: "FAILURE", discoverySearches: 0 }); } catch { /* Preserve the original failure. */ }
    await finishRun(ownerId, run);
    return run;
  }
}
