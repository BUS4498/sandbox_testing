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

test("generic observable tool activity remains generic rather than claiming a spreadsheet update", () => {
  const event = mapRuntimeEvent({
    method: "item/started",
    params: { item: { type: "commandExecution", command: "node check.js" } },
  });
  assert.equal(event.stage, "ACTING");
  assert.equal(event.label, "Acting");
});
