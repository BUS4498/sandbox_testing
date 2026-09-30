import assert from "node:assert/strict";
import test from "node:test";
import { applyTargetedAssessment } from "../lib/hosted/targeted-assessment-application.js";

const base = {
  opportunityId: "opportunity-1", recordVersion: 2, fitAssessment: "MODERATE", agentDecision: "MONITOR",
  decisionRationale: "Location feasibility is unclear.", selectionEvidence: ["Employer posting verified."],
  fitEvidence: {
    requiredMatches: ["Verified coursework"], preferredMatches: [],
    gaps: ["California commute availability is unconfirmed.", "SQL skill is not verified."],
    unknowns: ["Employer application deadline is unknown.", "Remote-work preference is unconfirmed."],
    preferenceAlignment: [],
  },
  nextAction: "Confirm commute.", nextActionRequest: { prompt: "Can you commute?", responseType: "TEXT", options: [], whatHappensNext: "Reassess." },
  unresolvedIssue: "Commute is unconfirmed.", attentionRequired: true,
  fitScore: { status: "SCORED", value: 60, reason: "Earlier evidence.", evidenceFingerprint: "old" },
};
const response = { id: "response-1" };
const setup = { mode: "REAL", confirmedAt: "2026-09-29T00:00:00Z" };
const proposal = {
  fitAssessment: "STRONG", agentDecision: "PREPARE", decisionRationale: "Commute was confirmed by the student, but SQL remains unverified.",
  resolvedGapIndexes: [0, 1], resolvedUnknownIndexes: [0, 1], resolution: "PARTIAL", responseExplanation: "Commute answered; employer deadline still needs checking.",
  nextAction: "Review the remaining evidence.", nextQuestion: "Can you supply verified SQL experience?", whatHappensNext: "Reassess the confirmed profile.",
  unresolvedIssue: "The employer deadline is still unknown.", attentionRequired: true,
};

test("OpenAI targeted assessment may resolve student-owned practical facts but not qualifications or employer facts", () => {
  const result = applyTargetedAssessment(base, response, proposal, setup, "2026-09-29T01:00:00Z");
  assert.deepEqual(result.fitEvidence.gaps, ["SQL skill is not verified."]);
  assert.deepEqual(result.fitEvidence.unknowns, ["Employer application deadline is unknown."]);
  assert.deepEqual(result.fitEvidence.requiredMatches, base.fitEvidence.requiredMatches);
  assert.match(result.unresolvedIssue, /unverified in the approved evidence/);
  assert.equal(result.fitScore.status, "STALE");
  assert.equal(result.agentDecision, "PREPARE");
  assert.equal(result.nextActionRequest.responseType, "TEXT");
  assert.match(result.selectionEvidence.at(-1), /student-reported information/);
  assert.equal(base.fitScore.status, "SCORED");
});
