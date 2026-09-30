import test from "node:test";
import assert from "node:assert/strict";
import { assessmentMatchesSetup, cleanNextAction, materialMatchesSetup, sourceCheckPending, studentResponseNeeded } from "../lib/hosted/opportunity-state.js";

const confirmedAt = "2026-09-29T21:41:21.744Z";
const setup = { mode: "REAL", confirmedAt };
const base = {
  assessmentProfileMode: "REAL", postingStatus: "ACTIVE", lastAgentReview: "2026-09-29T21:42:00.000Z",
  attentionRequired: false, nextAction: "Review the posting.",
  nextActionRequest: { prompt: "", responseType: "NONE" },
};

test("a new real resume invalidates earlier real-resume assessments and scores", () => {
  assert.equal(assessmentMatchesSetup({ ...base, assessmentProfileConfirmedAt: confirmedAt }, setup), true);
  assert.equal(assessmentMatchesSetup({ ...base, assessmentProfileConfirmedAt: "2026-09-28T12:00:00Z" }, setup), false);
  assert.equal(assessmentMatchesSetup({ ...base, assessmentProfileConfirmedAt: null }, setup), false);
  assert.equal(assessmentMatchesSetup({ ...base, lastAgentReview: "2026-09-29T21:33:00Z" }, setup), false);
  assert.equal(assessmentMatchesSetup(base, setup), true); // Legacy record assessed after confirmation.
});

test("agent source checks are not counted as student questions", () => {
  const pending = { ...base, postingStatus: "UNCERTAIN", attentionRequired: true,
    nextAction: "No student response is requested. Verify the employer's current posting status." };
  assert.equal(sourceCheckPending(pending), true);
  assert.equal(studentResponseNeeded(pending), false);
  assert.equal(cleanNextAction(pending.nextAction), "Verify the employer's current posting status.");
  const question = { ...pending, nextActionRequest: { prompt: "Can you work onsite?", responseType: "INFORMATION" } };
  assert.equal(sourceCheckPending(question), false);
  assert.equal(studentResponseNeeded(question), true);
});

test("Word drafts from an earlier confirmed resume are not current materials", () => {
  const oldDraft = { profileMode: "REAL", createdAt: "2026-09-29T21:33:00Z" };
  assert.equal(materialMatchesSetup(oldDraft, setup), false);
  assert.equal(materialMatchesSetup({ ...oldDraft, createdAt: "2026-09-29T21:42:00Z" }, setup), true);
});
