import assert from "node:assert/strict";
import test from "node:test";
import { privateAssessmentInput } from "../lib/hosted/assessment-input.js";

test("private review receives only selected source-checked posting facts", () => {
  const result = privateAssessmentInput({
    runSummary: { candidatesDiscovered: 15 },
    selectedOpportunities: [{
      selectionEvidence: ["Employer posting inspected"],
      unresolvedIssue: "Deadline unclear",
      fitEvidence: { unknowns: ["Deadline"] },
      decisionRationale: "Provisional discovery conclusion",
      opportunity: { company: "Example", roleTitle: "Analyst Intern", postingUrl: "https://example.org/role", requiredQualifications: ["SQL"], responsibilities: ["Analyze data"], privateNote: "omit" },
    }],
  });
  assert.equal(result.length, 1);
  assert.equal(result[0].selectionIndex, 0);
  assert.deepEqual(result[0].requiredQualifications, ["SQL"]);
  assert.equal(result[0].unresolvedSourceIssue, "Deadline unclear");
  assert.equal(JSON.stringify(result).includes("Provisional discovery conclusion"), false);
  assert.equal(JSON.stringify(result).includes("privateNote"), false);
  assert.equal(JSON.stringify(result).includes("candidatesDiscovered"), false);
});
