import assert from "node:assert/strict";
import test from "node:test";
import { mergePrivateAssessment } from "../lib/hosted/private-assessment-contract.js";
import { parseAndValidateWorkflowResult } from "../lib/hosted/specs/workflow-result-contract.js";

function discovery() {
  return parseAndValidateWorkflowResult(JSON.stringify({
    schemaVersion: 1,
    runSummary: { searchesPerformed: 4, candidatesDiscovered: 12, duplicatesOrInvalid: 9, candidatesRanked: 3, selectionShortfallReason: "" },
    selectedOpportunities: [0, 1, 2].map((index) => ({
      updateDisposition: "NEW", existingOpportunityId: null,
      opportunity: {
        opportunityId: null, company: `Employer ${index}`, roleTitle: "Business Analyst Intern", location: "California",
        workArrangement: "Hybrid", internshipPeriod: "Summer 2027", deadline: "Unknown", source: "Employer careers",
        postingUrl: `https://example.com/jobs/${index}`, applicationUrl: "", employerPostingId: String(index), postingStatus: "ACTIVE",
        responsibilities: ["Analyze business processes"], requiredQualifications: ["Business coursework"], preferredQualifications: [],
        dateDiscovered: "2026-09-29", lastVerified: "2026-09-29",
      },
      fitAssessment: "INSUFFICIENT INFORMATION", agentDecision: "MONITOR", decisionRationale: "Private review pending.",
      selectionEvidence: ["Role-specific employer posting was inspected."],
      fitEvidence: { requiredMatches: [], preferredMatches: [], gaps: [], unknowns: ["Private review pending."], preferenceAlignment: [] },
      whatChanged: [], nextAction: "Wait for private assessment.",
      nextActionRequest: { prompt: "", responseType: "NONE", options: [], whatHappensNext: "" },
      nextActionDate: "Unknown", unresolvedIssue: "", attentionRequired: false, studentInputResolution: null,
      applicationPrep: { status: "NOT_REQUESTED", templates: [], nextStep: "" },
    })),
    unresolvedIssues: ["No private resume evidence was used in discovery; student-specific fit assessments remain INSUFFICIENT INFORMATION pending the separate no-web assessment."],
  }), { observedSearches: 4, mode: "DISCOVERY" });
}

function privateOutput() {
  return {
    assessments: [0, 1, 2].map((selectionIndex) => ({
      selectionIndex, fitAssessment: "MODERATE", agentDecision: "MONITOR", decisionRationale: "Verified coursework matches one requirement.",
      fitEvidence: { requiredMatches: ["Business coursework"], preferredMatches: [], gaps: [], unknowns: ["Deadline is not stated."], preferenceAlignment: ["California"] },
      nextAction: "Review the verified posting.",
      nextActionRequest: { prompt: "", responseType: "NONE", options: [], whatHappensNext: "" },
      nextActionDate: "Unknown", unresolvedIssue: "Deadline is not stated.", attentionRequired: false,
    })),
    unresolvedIssues: ["Deadline is not stated."],
  };
}

test("private fit review changes assessment only while preserving three verified postings and search counts", () => {
  const source = discovery();
  const result = mergePrivateAssessment(JSON.stringify(privateOutput()), source, 4);
  assert.deepEqual(result.runSummary, source.runSummary);
  assert.deepEqual(result.selectedOpportunities.map((item) => item.opportunity), source.selectedOpportunities.map((item) => item.opportunity));
  assert.deepEqual(result.selectedOpportunities.map((item) => item.selectionEvidence), source.selectedOpportunities.map((item) => item.selectionEvidence));
  assert.deepEqual(result.selectedOpportunities.map((item) => item.fitAssessment), ["MODERATE", "MODERATE", "MODERATE"]);
  assert.deepEqual(result.unresolvedIssues, ["Deadline is not stated."]);
});

test("private fit review rejects missing, repeated or out-of-scope selections", () => {
  const source = discovery();
  const missing = privateOutput(); missing.assessments.pop();
  assert.throws(() => mergePrivateAssessment(JSON.stringify(missing), source, 4), /covered 2 of 3/);
  const repeated = privateOutput(); repeated.assessments[2].selectionIndex = 1;
  assert.throws(() => mergePrivateAssessment(JSON.stringify(repeated), source, 4), /repeated/);
  const rewritten = privateOutput(); rewritten.runSummary = { searchesPerformed: 0 };
  assert.throws(() => mergePrivateAssessment(JSON.stringify(rewritten), source, 4), /outside its permitted scope/);
});

test("private fit review reports invalid evidence fields instead of saving a provisional fit", () => {
  const source = discovery();
  const invalid = privateOutput(); invalid.assessments[0].fitEvidence.requiredMatches = ["x".repeat(1_001)];
  assert.throws(() => mergePrivateAssessment(JSON.stringify(invalid), source, 4), /exceeded 1000 characters/);
});
