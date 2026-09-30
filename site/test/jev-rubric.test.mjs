import test from "node:test";
import assert from "node:assert/strict";
import { compactFitEvidence, normalizeJevAnswer, scoreQuestions } from "../lib/hosted/jev-rubric.js";

const setup = {
  mode: "REAL", ready: true,
  profileText: "Private Student Name, student@example.edu, 555-555-0199",
  preferences: {
    roles: ["AI Business Analyst Intern", "Data Analyst Intern"],
    workArrangements: ["HYBRID", "REMOTE"],
    geographicBoundaries: "Private home address; California",
    availableFrom: "2027-05-01", availableThrough: "2027-08-31",
    additionalConstraints: "Private family circumstances",
  },
};
const record = {
  postingStatus: "ACTIVE", assessmentProfileMode: "REAL", fitAssessment: "STRONG",
  postingUrl: "https://careers.example.com/job/123", lastVerified: "2026-09-28",
  decisionRationale: "Private Student Name is a good fit.",
  roleTitle: "AI Business Analyst Intern", location: "San Francisco, California",
  workArrangement: "Hybrid", internshipPeriod: "Summer 2027", deadline: "2027-01-10",
  fitEvidence: {
    requiredMatches: ["Private Student Name knows SQL and Excel; email student@example.edu"],
    preferredMatches: ["Python project and Power BI dashboard"],
    gaps: ["No professional consulting experience"],
    unknowns: ["Unknown travel requirement"],
    preferenceAlignment: ["Relevant AI business analysis work"],
  },
};

test("Jev receives categories and counts, never raw resume or identifiers", () => {
  const projection = compactFitEvidence(record, setup);
  assert.ok(projection);
  const sent = JSON.stringify(projection);
  for (const privateText of ["Private Student Name", "student@example.edu", "555-555-0199", "Private home address", "Private family circumstances", "careers.example.com"]) {
    assert.equal(sent.includes(privateText), false);
  }
  assert.equal(projection.qualification.requiredMatches, 1);
  assert.deepEqual(projection.qualification.matchTopics.includes("SQL"), true);
  assert.equal(projection.career.roleCategory, "AI-related analysis");
});

test("missing or stale evidence cannot be scored", () => {
  assert.equal(compactFitEvidence({ ...record, assessmentProfileMode: "SYNTHETIC_DEMONSTRATION" }, setup), null);
  assert.equal(compactFitEvidence({ ...record, postingStatus: "CLOSED" }, setup), null);
  assert.equal(compactFitEvidence({ ...record, postingStatus: "UNCERTAIN" }, setup), null);
  assert.equal(compactFitEvidence({ ...record, assessmentProfileConfirmedAt: "2026-09-27T00:00:00Z" }, { ...setup, confirmedAt: "2026-09-28T00:00:00Z" }), null);
  assert.equal(compactFitEvidence({ ...record, fitAssessment: "INSUFFICIENT INFORMATION" }, setup), null);
  assert.equal(compactFitEvidence({ ...record, fitEvidence: { requiredMatches: [], preferredMatches: [], gaps: [], unknowns: [] } }, setup), null);
});

test("legacy category-plus-narrative assessments remain eligible without rewriting the record", () => {
  assert.ok(compactFitEvidence({ ...record, fitAssessment: "MODERATE: Location confirmed; dates remain unknown." }, setup));
  assert.equal(compactFitEvidence({ ...record, fitAssessment: "MODERATELY ALIGNED" }, setup), null);
});

test("approved-source uncertainty permits evidence-ready scoring and carries the caveat privately", () => {
  const projection = compactFitEvidence({ ...record, postingStatus: "UNCERTAIN", postingUrl: "https://simplify.jobs/p/123/AI-Analyst-Intern", deadline: "Unknown" }, setup);
  assert.ok(projection);
  assert.equal(projection.practical.postingStatus, "UNCERTAIN");
  assert.equal(projection.practical.activeStatusConfirmed, false);
  assert.equal(projection.practical.deadlineKnown, false);
  assert.equal(JSON.stringify(projection).includes("simplify.jobs"), false);
  assert.equal(JSON.stringify(projection).includes("Private Student Name"), false);
  assert.equal(compactFitEvidence({ ...record, postingStatus: "UNCERTAIN", postingUrl: "https://simplify.jobs/l/Top-Summer-Internships-2027" }, setup), null);
  assert.equal(compactFitEvidence({ ...record, postingStatus: "UNCERTAIN", postingUrl: "https://simplify.jobs/p/123", fitAssessment: "INSUFFICIENT INFORMATION" }, setup), null);
});

test("unmarked legacy assessments can only use the synthetic demonstration profile", () => {
  const legacy = { ...record, assessmentProfileMode: undefined };
  assert.equal(compactFitEvidence(legacy, setup), null);
  assert.ok(compactFitEvidence(legacy, { ...setup, mode: "SYNTHETIC_DEMONSTRATION" }));
});

test("scoring uses three descriptive questions and rounds to five-point steps", () => {
  const questions = scoreQuestions();
  assert.deepEqual(Object.keys(questions), ["qualifications", "career", "practical"]);
  assert.equal(questions.qualifications.criteria.length, 5);
  const answer = (score) => ({ type: "score", score, confidence: 0.8 });
  const result = normalizeJevAnswer({ answers: { qualifications: answer(3.4), career: answer(2.8), practical: answer(2) } });
  assert.equal(result.value % 5, 0);
  assert.ok(result.value >= 0 && result.value <= 100);
  assert.throws(() => normalizeJevAnswer({ answers: { qualifications: answer(8), career: answer(2), practical: answer(2) } }));
});
