import test from "node:test";
import assert from "node:assert/strict";
import { strFromU8, unzipSync } from "fflate";
import { createCollectionWorkbook } from "../lib/hosted/xlsx.ts";

test("spreadsheet omits an earlier resume's score and labels agent-owned source work", () => {
  const setup = { mode: "REAL", ready: true, profileText: "", preferences: null, confirmedAt: "2026-09-29T21:41:00Z", updatedAt: null };
  const record = {
    opportunityId: "example", dateAdded: "2026-09-29", dateDiscovered: "2026-09-29", lastUpdated: "2026-09-29", lastVerified: "2026-09-29", lastAgentReview: "2026-09-29T21:33:00Z",
    company: "Example", roleTitle: "Analyst Intern", location: "California", workArrangement: "Hybrid", internshipPeriod: "Summer 2027", deadline: "Unknown", source: "Employer", postingUrl: "https://example.org/job", applicationUrl: "", postingStatus: "UNCERTAIN",
    fitAssessment: "MODERATE", fitScore: { status: "SCORED", value: 80, model: "jev-1.13.0", rubricVersion: "v1", scoredAt: "2026-09-29T21:34:00Z" }, assessmentProfileMode: "REAL",
    agentDecision: "MONITOR", decisionRationale: "Prior profile evidence", applicationStatus: "NOT_STARTED", nextAction: "No student response is requested. Verify the employer posting.", nextActionDate: "", unresolvedIssue: "Employer status unknown", studentNotes: "",
    attentionRequired: true, nextActionRequest: { prompt: "", responseType: "NONE" },
  };
  const file = unzipSync(createCollectionWorkbook([record], setup));
  const sheet = strFromU8(file["xl/worksheets/sheet1.xml"]);
  assert.match(sheet, /NEEDS REASSESSMENT/);
  assert.match(sheet, /<t xml:space="preserve">STALE<\/t>/);
  assert.match(sheet, /Agent source check, then reassess for the current resume/);
  assert.doesNotMatch(sheet, /<t xml:space="preserve">80<\/t>/);
  assert.doesNotMatch(sheet, /Prior profile evidence/);
});

test("current preliminary fit scores export as sortable Excel numbers", () => {
  const setup = { mode: "REAL", ready: true, profileText: "", preferences: null, confirmedAt: "2026-09-29T21:00:00Z", updatedAt: null };
  const record = {
    opportunityId: "example", dateAdded: "2026-09-29", dateDiscovered: "2026-09-29", lastUpdated: "2026-09-29", lastVerified: "2026-09-29", lastAgentReview: "2026-09-29T21:33:00Z",
    company: "Example", roleTitle: "Analyst Intern", location: "California", workArrangement: "Hybrid", internshipPeriod: "Summer 2027", deadline: "Unknown", source: "Employer", postingUrl: "https://example.org/job", applicationUrl: "https://example.org/apply", postingStatus: "ACTIVE",
    fitAssessment: "MODERATE", fitScore: { status: "SCORED", value: 80, model: "jev-1.13.0", rubricVersion: "v1", scoredAt: "2026-09-29T21:34:00Z" }, assessmentProfileMode: "REAL",
    agentDecision: "MONITOR", decisionRationale: "Verified profile evidence", applicationStatus: "NOT_STARTED", nextAction: "Review posting.", nextActionDate: "", unresolvedIssue: "", studentNotes: "",
    attentionRequired: false, nextActionRequest: { prompt: "", responseType: "NONE" },
  };
  const file = unzipSync(createCollectionWorkbook([record], setup));
  const sheet = strFromU8(file["xl/worksheets/sheet1.xml"]);
  assert.match(sheet, /<c r="Q2" t="n"><v>80<\/v><\/c>/);
  assert.match(strFromU8(file["xl/styles.xml"]), /<cellStyles count="1">/);
});
