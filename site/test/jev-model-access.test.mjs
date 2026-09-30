import assert from "node:assert/strict";
import test from "node:test";
import { inspectJevModels, selectJevModel } from "../lib/hosted/jev-model-access.js";

test("Jev connection resolves a listed release or approved alias", () => {
  assert.equal(inspectJevModels({ models: [{ name: "jev-1.13.0" }] }, "jev-1.13.0"), "AVAILABLE");
  assert.equal(inspectJevModels({ models: [{ name: "jev-latest" }] }, "jev-1.13.0"), "AVAILABLE");
  assert.equal(selectJevModel({ models: [{ name: "jev-latest" }] }, "jev-1.13.0"), "jev-latest");
  assert.equal(selectJevModel({ models: [{ name: "other-model" }] }, "jev-1.13.0"), null);
});

test("malformed model-list replies are not labeled connected", () => {
  assert.equal(inspectJevModels(null, "jev-1.13.0"), "INVALID_RESPONSE");
  assert.equal(inspectJevModels({ models: "jev-1.13.0" }, "jev-1.13.0"), "INVALID_RESPONSE");
});
