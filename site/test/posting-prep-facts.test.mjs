import assert from "node:assert/strict";
import { test } from "node:test";
import { publicPostingFacts } from "../lib/hosted/posting-prep-facts.js";

test("interview preparation receives the retained posting duties and qualifications", () => {
  const facts = publicPostingFacts({ company: "Synthetic Employer", roleTitle: "Systems Intern", location: "California", postingUrl: "https://example.org/job", responsibilities: ["Map business workflows"], requiredQualifications: ["SQL coursework"], preferredQualifications: ["Power BI experience"] });
  assert.deepEqual(facts.responsibilities, ["Map business workflows"]);
  assert.deepEqual(facts.requirements, ["SQL coursework", "Power BI experience"]);
  assert.equal("profileText" in facts, false);
});

test("older opportunities do not acquire invented posting details", () => {
  const facts = publicPostingFacts({ company: "Synthetic Employer", roleTitle: "Systems Intern", location: "California", postingUrl: "https://example.org/job" });
  assert.deepEqual(facts.responsibilities, []);
  assert.deepEqual(facts.requirements, []);
});
