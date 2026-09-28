import assert from "node:assert/strict";
import test from "node:test";

import { mapRuntimeEvent, publicRuntimeEvent } from "../src/controller/runtime-event-mapper.js";

test("maps only controller-owned business stages", () => {
  const searching = mapRuntimeEvent({
    method: "internship/stage",
    params: { stage: "SEARCHING_WEB", detail: "Searching approved public career sources." },
  });
  assert.equal(searching.stage, "SEARCHING_WEB");
  assert.equal(searching.progressPercent, 20);
  assert.match(searching.detail, /approved public career sources/);
  assert.equal(mapRuntimeEvent({ method: "internship/stage", params: { stage: "SHOW_CHAIN_OF_THOUGHT" } }), null);
});

test("never exposes provider reasoning, message deltas, or arbitrary tool events", () => {
  for (const method of ["response.reasoning.delta", "response.output_text.delta", "item/agentMessage/delta", "item/started"]) {
    assert.equal(publicRuntimeEvent({ method, params: { delta: "private content" } }), null);
  }
});

test("publishes plain-language progress without hidden reasoning", () => {
  const event = publicRuntimeEvent({
    method: "internship/stage",
    params: { stage: "PREPARING_WORD_DRAFT", detail: "Creating a review-only Word draft in the private opportunity folder." },
  });
  assert.deepEqual(event, {
    type: "run.stage",
    stage: "PREPARING_WORD_DRAFT",
    label: "Preparing Word Draft",
    detail: "Creating a review-only Word draft in the private opportunity folder.",
    progressPercent: 82,
  });
});
