import assert from "node:assert/strict";
import { test } from "node:test";
import { safeResumeEdits, validateResumeEdits } from "../lib/hosted/resume-edit-guards.js";

const evidence = [{ id: "E1", text: "Built a Power BI dashboard for a course project." }];
const selected = [{ evidenceId: "E1" }];

test("safe in-place resume wording can reorder existing verified words", () => {
  assert.equal(validateResumeEdits([{ evidenceId: "E1", revisedText: "For a course project, built a Power BI dashboard." }], selected, evidence).length, 1);
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
