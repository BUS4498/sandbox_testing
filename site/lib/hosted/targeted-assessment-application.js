const STUDENT_OWNED_PRACTICAL = /\b(availability|available|commut\w*|relocat\w*|travel|on.?site|remote|hybrid|schedule|hours|work.arrangement|geograph\w*|location.feasib\w*|paid|unpaid)\b/i;
const EMPLOYER_OWNED_FACT = /\b(deadline|posting|employer|requirement|opening|closed|active|cohort|salary|application.link|job.listing)\b/i;

function mayResolveFromStudentAnswer(issue) {
  return STUDENT_OWNED_PRACTICAL.test(issue) && !EMPLOYER_OWNED_FACT.test(issue);
}

export function applyTargetedAssessment(current, response, proposal, setup, now) {
  const originalGaps = current.fitEvidence.gaps;
  const originalUnknowns = current.fitEvidence.unknowns;
  const safeGapIndexes = new Set(proposal.resolvedGapIndexes.filter((index) => mayResolveFromStudentAnswer(originalGaps[index])));
  const safeUnknownIndexes = new Set(proposal.resolvedUnknownIndexes.filter((index) => mayResolveFromStudentAnswer(originalUnknowns[index])));
  const unsupportedResolution = safeGapIndexes.size !== proposal.resolvedGapIndexes.length || safeUnknownIndexes.size !== proposal.resolvedUnknownIndexes.length;
  const unresolvedIssue = [proposal.unresolvedIssue, unsupportedResolution ? "A student-reported qualification or employer-owned fact remains unverified in the approved evidence." : ""].filter(Boolean).join(" ");
  return {
    ...current,
    recordVersion: current.recordVersion + 1,
    lastUpdated: now,
    lastAgentReview: now,
    fitAssessment: proposal.fitAssessment,
    fitEvidence: {
      ...current.fitEvidence,
      gaps: originalGaps.filter((_, index) => !safeGapIndexes.has(index)),
      unknowns: originalUnknowns.filter((_, index) => !safeUnknownIndexes.has(index)),
    },
    fitScore: current.fitScore ? { ...current.fitScore, status: "STALE", reason: "The student response changed the qualitative review; Jev scoring needs rechecking." } : undefined,
    agentDecision: proposal.agentDecision,
    decisionRationale: proposal.decisionRationale,
    nextAction: proposal.nextAction,
    nextActionRequest: proposal.nextQuestion
      ? { prompt: proposal.nextQuestion, responseType: "TEXT", options: [], whatHappensNext: proposal.whatHappensNext || "The agent will reassess this opportunity after your response is saved." }
      : { prompt: "", responseType: "NONE", options: [], whatHappensNext: "" },
    unresolvedIssue,
    attentionRequired: proposal.attentionRequired || unsupportedResolution,
    selectionEvidence: [...current.selectionEvidence, `Student response ${response.id} reviewed by OpenAI as student-reported information: ${proposal.responseExplanation}`].slice(-12),
    assessmentProfileMode: setup.mode === "REAL" ? "REAL" : "SYNTHETIC_DEMONSTRATION",
    assessmentProfileConfirmedAt: setup.confirmedAt,
    lastProcessedResponseId: response.id,
  };
}
