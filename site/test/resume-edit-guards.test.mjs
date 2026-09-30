import assert from "node:assert/strict";
import { test } from "node:test";
import { changedTextRuns, safeResumeEdits, validateResumeEdits } from "../lib/hosted/resume-edit-guards.js";

const evidence = [{ id: "E1", text: "Built a Power BI dashboard for a course project." }];
const selected = [{ evidenceId: "E1" }];

test("safe in-place resume wording can reorder existing verified words", () => {
  assert.equal(validateResumeEdits([{ evidenceId: "E1", revisedText: "For a course project, built a Power BI dashboard." }], selected, evidence).length, 1);
});

test("a supported sentence rewrite can use neutral action wording and explains job relevance", () => {
  const edit = { evidenceId: "E1", revisedText: "For a course project, developed a Power BI dashboard.", requirement: "Prepare dashboards.", rationale: "Makes the dashboard action easier to identify without changing the course-project scope." };
  assert.equal(validateResumeEdits([edit], selected, evidence).length, 1);
  const runs = changedTextRuns(evidence[0].text, edit.revisedText);
  assert.equal(runs.map(run => run.text).join(""), edit.revisedText);
  assert.ok(runs.some(run => run.highlight && run.text.includes("developed")));
  assert.ok(runs.some(run => !run.highlight && run.text.includes("Power BI")));
});

test("unsafe proposals do not discard a separate valid edit; numbers and named tools are protected", () => {
  const sources = [...evidence, { id: "E2", text: "Built 5+ Excel trackers for 8 campus teams." }];
  const choice = [{ evidenceId: "E1" }, { evidenceId: "E2" }];
  const result = safeResumeEdits([
    { evidenceId: "E1", revisedText: "For a course project, built a Power BI dashboard." },
    { evidenceId: "E2", revisedText: "Built 10 Excel trackers for 8 campus teams." },
  ], choice, sources);
  assert.equal(result.edits.length, 1); assert.equal(result.omitted, true);
  assert.throws(() => validateResumeEdits([{ evidenceId: "E2", revisedText: "Built 5+ Tableau trackers for 8 campus teams.", requirement: "Prepare reports", rationale: "A misleading proposed skill" }], choice, sources));
});

test("resume revisions cannot add a new qualification or drop a limiting word", () => {
  assert.throws(() => validateResumeEdits([{ evidenceId: "E1", revisedText: "Built an advanced Power BI dashboard for a course project." }], selected, evidence));
  assert.throws(() => validateResumeEdits([{ evidenceId: "E1", revisedText: "Built a Power BI dashboard." }], selected, evidence));
});

test("unsafe optional wording is omitted rather than blocking the complete resume", () => {
  const result = safeResumeEdits([{ evidenceId: "E1", revisedText: "Built an advanced Power BI dashboard for a course project." }], selected, evidence);
  assert.deepEqual(result, { edits: [], omitted: true });
  assert.deepEqual(safeResumeEdits([], selected, evidence), { edits: [], omitted: false });
});
