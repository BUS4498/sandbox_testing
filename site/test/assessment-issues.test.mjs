import assert from "node:assert/strict";
import test from "node:test";
import { finalAssessmentIssues } from "../lib/hosted/assessment-issues.js";

test("completed private review removes provisional discovery notes but keeps genuine source and fit issues", () => {
  const issues = finalAssessmentIssues(
    ["No private resume evidence was used in discovery; student-specific fit assessments remain INSUFFICIENT INFORMATION pending the separate no-web assessment.", "The employer did not state a deadline."],
    ["The student has not confirmed work-arrangement flexibility.", "The employer did not state a deadline."]
  );
  assert.deepEqual(issues, ["The employer did not state a deadline.", "The student has not confirmed work-arrangement flexibility."]);
});

test("mixed discovery notes retain source caveats without contradicting completed assessment and persistence", () => {
  const issues = finalAssessmentIssues([
    "Budget accounting: three searches were used. All student-specific assessments are intentionally INSUFFICIENT INFORMATION because the private resume was omitted from this discovery request. No required/preferred qualification matches or genuine student gaps are claimed. Current employer acceptance was not independently established. Results are proposals for subsequent no-web assessment, not saved records. No spreadsheet writes, application submissions, communications, scoring-service calls, or material preparation occurred. Selection 3 has conflicting deadline evidence.",
    "Private resume evidence was intentionally absent. No student qualification matches, fit scores, persistence, submissions, communications, or material changes were performed.",
    "No private resume evidence was supplied to discovery. Qualification matches and genuine student gaps remain unresolved until the separate no-web assessment. No persistence, application submission, communications, or material preparation was performed.",
  ], ["The student must clarify onsite availability."]);
  assert.deepEqual(issues, [
    "Budget accounting: three searches were used. Current employer acceptance was not independently established. Selection 3 has conflicting deadline evidence.",
    "The student must clarify onsite availability.",
  ]);
});

test("source access failures, qualification gaps, and actual assessment issues remain visible", () => {
  const issues = finalAssessmentIssues([
    "No employer application entry point could be verified. The listing date is unknown.",
    "The student may need to confirm the enrollment requirement.",
    "No persistence was performed for another record because its write failed.",
  ], ["No verified accounting coursework is available.", "The collection write failed for another record."]);
  assert.equal(issues.length, 5);
  assert.match(issues.join(" "), /application entry point/);
  assert.match(issues.join(" "), /collection write failed/);
});
