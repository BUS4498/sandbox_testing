import assert from "node:assert/strict";
import { test } from "node:test";
import { parseAndValidateWorkflowResult } from "../lib/hosted/specs/workflow-result-contract.js";

function resultWithWorkArrangement(workArrangement) {
  return {
    schemaVersion: 1,
    runSummary: {
      searchesPerformed: 1,
      candidatesDiscovered: 1,
      duplicatesOrInvalid: 0,
      candidatesRanked: 1,
      selectionShortfallReason: "Only one verified role qualified in this bounded test.",
    },
    selectedOpportunities: [{
      updateDisposition: "NEW",
      existingOpportunityId: null,
      opportunity: {
        opportunityId: null,
        company: "Example Employer",
        roleTitle: "Business Analyst Intern",
        location: "California",
        workArrangement,
        internshipPeriod: "Summer 2027",
        deadline: "Unknown",
        source: "Employer careers",
        postingUrl: "https://example.com/jobs/123",
        applicationUrl: "",
        employerPostingId: "123",
        postingStatus: "UNCERTAIN",
        responsibilities: [],
        requiredQualifications: [],
        preferredQualifications: [],
        dateDiscovered: "2026-09-28",
        lastVerified: "2026-09-28",
      },
      fitAssessment: "MODERATE",
      agentDecision: "MONITOR",
      decisionRationale: "Relevant role; work arrangement requires confirmation.",
      selectionEvidence: ["Individual posting inspected."],
      fitEvidence: {
        requiredMatches: [],
        preferredMatches: [],
        gaps: [],
        unknowns: ["Work arrangement requires confirmation."],
        preferenceAlignment: [],
      },
      whatChanged: [],
      nextAction: "Confirm the work arrangement.",
      nextActionRequest: { prompt: "", responseType: "NONE", options: [], whatHappensNext: "" },
      nextActionDate: "Unknown",
      unresolvedIssue: "",
      attentionRequired: false,
      studentInputResolution: null,
      applicationPrep: { status: "NOT_REQUESTED", templates: [], nextStep: "" },
    }],
    unresolvedIssues: [],
  };
}

test("accepts a factual work-arrangement description longer than the old 100-character cap", () => {
  const description = "Hybrid in California; the employer requires regular office collaboration and confirms scheduling details during interviews.";
  const result = parseAndValidateWorkflowResult(JSON.stringify(resultWithWorkArrangement(description)), { observedSearches: 1 });
  assert.equal(result.selectedOpportunities[0].opportunity.workArrangement, description);
});

test("reports the field when a work-arrangement description exceeds the revised limit", () => {
  assert.throws(
    () => parseAndValidateWorkflowResult(JSON.stringify(resultWithWorkArrangement("x".repeat(301))), { observedSearches: 1 }),
    /opportunity\.workArrangement exceeded 300 characters/,
  );
});

test("preserves a source-backed internship period longer than 150 characters", () => {
  const description = "The employer describes a summer cohort with a flexible start date, possible extension into the fall, and final dates to be confirmed with the team after interviews.";
  assert.ok(description.length > 150);
  const input = resultWithWorkArrangement("Hybrid");
  input.selectedOpportunities[0].opportunity.internshipPeriod = description;
  const result = parseAndValidateWorkflowResult(JSON.stringify(input), { observedSearches: 1 });
  assert.equal(result.selectedOpportunities[0].opportunity.internshipPeriod, description);
});

test("preserves a source-backed location description beyond the old 300-character cap", () => {
  const input = resultWithWorkArrangement("Hybrid");
  const description = "California location is listed as San Francisco or San Jose, with team assignment and onsite requirements to be confirmed. ".repeat(4);
  assert.ok(description.length > 300 && description.length <= 1_000);
  input.selectedOpportunities[0].opportunity.location = description;
  const result = parseAndValidateWorkflowResult(JSON.stringify(input), { observedSearches: 1 });
  assert.equal(result.selectedOpportunities[0].opportunity.location, description.trim());
});

test("identifies an excessive location field by name", () => {
  const input = resultWithWorkArrangement("Hybrid");
  input.selectedOpportunities[0].opportunity.location = "x".repeat(1001);
  assert.throws(() => parseAndValidateWorkflowResult(JSON.stringify(input), { observedSearches: 1 }), /opportunity\.location exceeded 1000 characters/);
});

test("names an overlong internship period instead of rejecting it as an anonymous text field", () => {
  const input = resultWithWorkArrangement("Hybrid");
  input.selectedOpportunities[0].opportunity.internshipPeriod = "x".repeat(1001);
  assert.throws(() => parseAndValidateWorkflowResult(JSON.stringify(input), { observedSearches: 1 }), /opportunity\.internshipPeriod exceeded 1000 characters/);
});
