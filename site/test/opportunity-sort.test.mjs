import test from "node:test";
import assert from "node:assert/strict";
import { currentPreliminaryScore, sortOpportunities } from "../lib/hosted/opportunity-sort.js";

function opportunity(opportunityId, value, options = {}) {
  return {
    opportunityId,
    company: options.company ?? opportunityId,
    roleTitle: "Analyst Intern",
    assessmentProfileMode: options.mode ?? "REAL",
    lastAgentReview: options.reviewed ?? "2026-09-27T00:00:00Z",
    fitScore: value === null ? undefined : { status: options.status ?? "SCORED", value },
  };
}

test("current valid scores sort high to low; unavailable and stale scores remain separate", () => {
  const records = [
    opportunity("unscored", null, { reviewed: "2026-09-30T00:00:00Z" }),
    opportunity("low", 55),
    opportunity("stale", 95, { status: "STALE" }),
    opportunity("high", 85),
    opportunity("zero", 0),
    opportunity("other-profile", 100, { mode: "SYNTHETIC_DEMONSTRATION" }),
  ];
  const originalOrder = records.map((record) => record.opportunityId);
  assert.deepEqual(sortOpportunities(records, "REAL").map((record) => record.opportunityId),
    ["high", "low", "zero", "unscored", "other-profile", "stale"]);
  assert.deepEqual(records.map((record) => record.opportunityId), originalOrder);
  assert.equal(currentPreliminaryScore(records[4], "REAL"), 0);
  assert.equal(currentPreliminaryScore(records[5], "REAL"), null);
});

test("recent-review alternative and score ties have stable ordering", () => {
  const records = [
    opportunity("zeta", 80, { company: "Zeta", reviewed: "2026-09-27T00:00:00Z" }),
    opportunity("alpha", 80, { company: "Alpha", reviewed: "2026-09-28T00:00:00Z" }),
    opportunity("beta", null, { company: "Beta", reviewed: "2026-09-29T00:00:00Z" }),
  ];
  assert.deepEqual(sortOpportunities(records, "REAL").map((record) => record.opportunityId), ["alpha", "zeta", "beta"]);
  assert.deepEqual(sortOpportunities(records, "REAL", "recent").map((record) => record.opportunityId), ["beta", "alpha", "zeta"]);
});

test("a changed confirmed resume removes older scores from the current sort", () => {
  const current = opportunity("current", 75, { reviewed: "2026-09-29T21:42:00Z" });
  current.assessmentProfileConfirmedAt = "2026-09-29T21:41:00Z";
  const prior = opportunity("prior", 95, { reviewed: "2026-09-29T21:33:00Z" });
  assert.equal(currentPreliminaryScore(prior, "REAL", "2026-09-29T21:41:00Z"), null);
  assert.equal(currentPreliminaryScore(current, "REAL", "2026-09-29T21:41:00Z"), 75);
  assert.deepEqual(sortOpportunities([prior, current], "REAL", "score", "2026-09-29T21:41:00Z").map((record) => record.opportunityId), ["current", "prior"]);
});
