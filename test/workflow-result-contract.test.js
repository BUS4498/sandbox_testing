import assert from "node:assert/strict";
import test from "node:test";

import {
  parseAndValidateWorkflowResult,
  WorkflowResultValidationError,
} from "../src/workflow/workflow-result-contract.js";

function selectedOpportunity(overrides = {}) {
  return {
    updateDisposition: "NEW",
    existingOpportunityId: null,
    opportunity: {
      opportunityId: "opp-001",
      company: "Northstar Retail Analytics",
      roleTitle: "Information Systems Intern",
      location: "San Luis Obispo, CA",
      workArrangement: "Hybrid",
      internshipPeriod: "Summer 2027",
      deadline: "2026-10-15",
      source: "Employer career page",
      postingUrl: "https://careers.example.edu/jobs/opp-001",
      applicationUrl: "https://apply.example.edu/jobs/opp-001",
      employerPostingId: "NS-001",
      postingStatus: "ACTIVE",
      dateDiscovered: "2026-08-25",
      lastVerified: "2026-08-25",
    },
    fitAssessment: "STRONG",
    agentDecision: "PRIORITIZE",
    decisionRationale: "Verified coursework and project evidence align with the stated requirements.",
    selectionEvidence: ["Required SQL coursework is supported by verified context."],
    fitEvidence: {
      requiredMatches: ["SQL coursework"],
      preferredMatches: ["Power BI project"],
      gaps: [],
      unknowns: ["Exact weekly schedule"],
      preferenceAlignment: ["Hybrid business-analysis work"],
    },
    whatChanged: ["New verified opportunity"],
    nextAction: "Review the posting and prepare application materials.",
    nextActionRequest: {
      prompt: "Confirm whether the weekly schedule is compatible.",
      responseType: "CONFIRMATION",
      options: [],
      whatHappensNext: "The immediate targeted update will reassess timing after the response is saved.",
    },
    nextActionDate: "2026-09-01",
    unresolvedIssue: "",
    attentionRequired: true,
    applicationPrep: { status: "NOT_REQUESTED", templates: [], nextStep: "" },
    ...overrides,
  };
}

function resultObject(overrides = {}) {
  return {
    schemaVersion: 1,
    runSummary: {
      searchesPerformed: 1,
      candidatesDiscovered: 4,
      duplicatesOrInvalid: 1,
      candidatesRanked: 3,
      selectionShortfallReason: "Only one sufficiently relevant, non-duplicate opportunity qualified in this synthetic test run.",
    },
    selectedOpportunities: [selectedOpportunity()],
    unresolvedIssues: [],
    ...overrides,
  };
}

test("accepts a bounded structured business result", () => {
  const result = parseAndValidateWorkflowResult(JSON.stringify(resultObject()), { observedSearches: 1 });
  assert.equal(result.selectedOpportunities.length, 1);
  assert.equal(result.selectedOpportunities[0].agentDecision, "PRIORITIZE");
  assert.equal(result.selectedOpportunities[0].opportunity.applicationUrl, "https://apply.example.edu/jobs/opp-001");
  assert.equal(result.selectedOpportunities[0].nextActionRequest.responseType, "CONFIRMATION");
  assert.equal(result.runSummary.candidatesDiscovered, 4);
});

test("allows a valid run to select fewer than five or no opportunities", () => {
  const result = parseAndValidateWorkflowResult(
    JSON.stringify(resultObject({
      runSummary: { searchesPerformed: 1, candidatesDiscovered: 2, duplicatesOrInvalid: 2, candidatesRanked: 0, selectionShortfallReason: "Both candidates were invalid." },
      selectedOpportunities: [],
    })),
    { observedSearches: 1 },
  );
  assert.equal(result.selectedOpportunities.length, 0);
});

test("requires an explicit reason when fewer than three opportunities are selected", () => {
  const value = resultObject();
  value.runSummary.selectionShortfallReason = "";
  assert.throws(() => parseAndValidateWorkflowResult(JSON.stringify(value)), /selectionShortfallReason/);
});

test("rejects quotas above three searches, fifteen candidates, or five updates", () => {
  assert.throws(
    () => parseAndValidateWorkflowResult(JSON.stringify(resultObject({ runSummary: { searchesPerformed: 4, candidatesDiscovered: 4, duplicatesOrInvalid: 0, candidatesRanked: 4 } }))),
    WorkflowResultValidationError,
  );
  assert.throws(
    () => parseAndValidateWorkflowResult(JSON.stringify(resultObject({ runSummary: { searchesPerformed: 1, candidatesDiscovered: 16, duplicatesOrInvalid: 0, candidatesRanked: 4 } }))),
    WorkflowResultValidationError,
  );
  assert.throws(
    () => parseAndValidateWorkflowResult(JSON.stringify(resultObject({
      runSummary: { searchesPerformed: 1, candidatesDiscovered: 10, duplicatesOrInvalid: 0, candidatesRanked: 10 },
      selectedOpportunities: Array.from({ length: 6 }, (_, index) => selectedOpportunity({
        opportunity: { ...selectedOpportunity().opportunity, opportunityId: `opp-${index}`, postingUrl: `https://careers.example.edu/jobs/${index}` },
      })),
    }))),
    /No more than five/,
  );
});

test("rejects a mismatch with observable web-search activity", () => {
  assert.throws(
    () => parseAndValidateWorkflowResult(JSON.stringify(resultObject()), { observedSearches: 2 }),
    /did not match observable web-search activity/,
  );
});

test("rejects private sources, full-page fields, and non-JSON prose", () => {
  const privateSource = resultObject();
  privateSource.selectedOpportunities[0].opportunity.postingUrl = "http://192.168.1.5/jobs/1";
  assert.throws(() => parseAndValidateWorkflowResult(JSON.stringify(privateSource)), /public posting source/);

  const rawPage = resultObject();
  rawPage.selectedOpportunities[0].opportunity.rawHtml = "<html>not allowed</html>";
  assert.throws(() => parseAndValidateWorkflowResult(JSON.stringify(rawPage)), /Forbidden sensitive or raw-content field/);
  assert.throws(() => parseAndValidateWorkflowResult(`Result:\n${JSON.stringify(resultObject())}`), /one valid JSON object/);
});

test("accepts one no-search targeted update and rejects discovery leakage", () => {
  const target = resultObject({
    runSummary: {
      searchesPerformed: 0,
      candidatesDiscovered: 0,
      duplicatesOrInvalid: 0,
      candidatesRanked: 0,
      selectionShortfallReason: "",
    },
    selectedOpportunities: [selectedOpportunity({
      updateDisposition: "MATERIALLY_CHANGED",
      existingOpportunityId: "opp-001",
      whatChanged: ["Student availability was confirmed."],
      studentInputResolution: {
        responseId: "response-001",
        status: "REVIEWED",
        outcome: "The availability question was resolved.",
        nextStep: "Prepare the review-only application checklist.",
      },
    })],
  });
  const parsed = parseAndValidateWorkflowResult(JSON.stringify(target), {
    observedSearches: 0,
    mode: "TARGETED_UPDATE",
    targetOpportunityId: "opp-001",
  });
  assert.equal(parsed.selectedOpportunities.length, 1);
  assert.equal(parsed.selectedOpportunities[0].studentInputResolution.responseId, "response-001");

  target.runSummary.searchesPerformed = 1;
  assert.throws(
    () => parseAndValidateWorkflowResult(JSON.stringify(target), { observedSearches: 1, mode: "TARGETED_UPDATE", targetOpportunityId: "opp-001" }),
    /zero discovery activity/,
  );
});

export { resultObject, selectedOpportunity };
