import assert from "node:assert/strict";
import test from "node:test";
import { normalizeStudentResponse } from "../lib/hosted/student-response-rules.js";
import { validateTargetedUpdate } from "../lib/hosted/targeted-update-contract.js";

const opportunityId = "9289ab1e-80b9-403b-af04-afde66712691";
const responseId = "c09cf343-3ca0-4af4-9e95-4bba19826e85";
const answer = { opportunityId, recordVersion: 2, responseType: "INFORMATION", responseText: "I can commute to the Los Angeles office for the full summer.", apiAssessmentConsent: true };
const proposal = {
  opportunityId, responseId, resolution: "RESOLVED", agentDecision: "PRIORITIZE",
  decisionRationale: "The student confirmed the location constraint; posting requirements remain unchanged.",
  fitAssessment: "MODERATE",
  resolvedGapIndexes: [0], resolvedUnknownIndexes: [0], nextAction: "Review the posting and decide whether to prepare materials.",
  nextQuestion: "", whatHappensNext: "", unresolvedIssue: "", attentionRequired: false,
  responseExplanation: "The Los Angeles feasibility question was resolved from the student's answer.",
};

test("specific student response can be saved for a scoped reassessment", () => {
  assert.equal(normalizeStudentResponse(answer).responseType, "INFORMATION");
});
test("private assessment consent, identifiers, and stale versions are rejected", () => {
  assert.throws(() => normalizeStudentResponse({ ...answer, apiAssessmentConsent: false }), /Confirm/);
  assert.throws(() => normalizeStudentResponse({ ...answer, responseText: "Email me at morgan@example.com" }), /email address/);
  assert.throws(() => normalizeStudentResponse({ ...answer, recordVersion: 0 }), /Refresh/);
});
test("not interested may be handled deterministically without model consent", () => {
  assert.equal(normalizeStudentResponse({ ...answer, responseType: "NOT_INTERESTED", responseText: "", apiAssessmentConsent: false }).responseType, "NOT_INTERESTED");
});
test("targeted proposal is locked to one opportunity and response", () => {
  const expected = { opportunityId, responseId, gapCount: 2, unknownCount: 1 };
  assert.equal(validateTargetedUpdate(proposal, expected).agentDecision, "PRIORITIZE");
  assert.throws(() => validateTargetedUpdate({ ...proposal, opportunityId: "other" }, expected), /different opportunity/);
  assert.throws(() => validateTargetedUpdate({ ...proposal, postingUrl: "https:\/\/example.com" }, expected), /unexpected fields/);
  assert.throws(() => validateTargetedUpdate({ ...proposal, resolvedGapIndexes: [3] }, expected), /evidence reference/);
});
test("unresolved reassessment must say what remains", () => {
  assert.throws(() => validateTargetedUpdate({ ...proposal, resolution: "PARTIAL" }, { opportunityId, responseId, gapCount: 2, unknownCount: 1 }), /remaining question/);
});
