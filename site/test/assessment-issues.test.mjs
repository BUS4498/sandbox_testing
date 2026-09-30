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
