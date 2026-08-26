import assert from "node:assert/strict";
import test from "node:test";

import { mapRuntimeEvent, publicRuntimeEvent } from "../src/controller/runtime-event-mapper.js";

test("maps observable web-search and completion events to business states", () => {
  const searching = mapRuntimeEvent({
    method: "item/started",
    params: { item: { type: "webSearch", action: { type: "search" } } },
  });
  assert.equal(searching.stage, "SEARCHING_WEB");
  assert.equal(searching.progressPercent, 20);
  assert.match(searching.detail, /verified preferences/);

  const finished = mapRuntimeEvent({
    method: "turn/completed",
    params: { turn: { status: "completed" } },
  });
  assert.equal(finished.stage, "FINISHED");
});

test("never exposes reasoning or agent-message deltas as dashboard events", () => {
  for (const method of [
    "item/reasoning/textDelta",
    "item/reasoning/summaryTextDelta",
    "item/agentMessage/delta",
    "item/plan/delta",
  ]) {
    assert.equal(publicRuntimeEvent({ method, params: { delta: "private content" } }), null);
  }
  assert.equal(
    publicRuntimeEvent({ method: "item/started", params: { item: { type: "reasoning", content: "private" } } }),
    null,
  );
});

test("uses only approved explicit internship business stages", () => {
  assert.equal(
    mapRuntimeEvent({ method: "internship/stage", params: { stage: "RANKING_OPPORTUNITIES" } }).label,
    "Ranking Opportunities",
  );
  assert.equal(mapRuntimeEvent({ method: "internship/stage", params: { stage: "SHOW_CHAIN_OF_THOUGHT" } }), null);
});

test("approval-waiting status becomes an explicit action request", () => {
  const event = mapRuntimeEvent({
    method: "thread/status/changed",
    params: { status: { type: "active", activeFlags: ["waitingOnApproval"] } },
  });
  assert.equal(event.stage, "NEEDS_ATTENTION");
  assert.equal(event.label, "Action required");
  assert.match(event.detail, /specific approval request/);
});

test("generic observable tool activity explains the safe observable operation without claiming success", () => {
  const event = mapRuntimeEvent({
    method: "item/started",
    params: { item: { type: "commandExecution", command: "node process-candidate.js" } },
  });
  assert.equal(event.stage, "ACTING");
  assert.equal(event.label, "Acting");
  assert.match(event.detail, /approved repository instructions/);
  assert.doesNotMatch(event.detail, /permitted local action/i);
});

test("recognizes verified context and Word-draft activity from observable metadata", () => {
  const context = mapRuntimeEvent({
    method: "item/started",
    params: { item: { type: "commandExecution", command: "read context/career-preferences.md" } },
  });
  assert.equal(context.stage, "RETRIEVING_PREFERENCES");
  assert.match(context.detail, /verified resume, career preferences/);

  const word = mapRuntimeEvent({
    method: "item/started",
    params: { item: { type: "fileChange", path: "data/local/application-materials/draft.docx" } },
  });
  assert.equal(word.stage, "PREPARING_WORD_DRAFT");
  assert.match(word.detail, /Word application draft/);
});
