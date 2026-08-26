import assert from "node:assert/strict";
import test from "node:test";

import { publicRuntimeReadiness, unavailableRuntimeReadiness } from "../src/controller/index.js";

const checkedAt = "2026-08-25T12:00:00.000Z";

test("maps managed ChatGPT authentication to a minimum-disclosure ready state", () => {
  const result = publicRuntimeReadiness(
    {
      account: { type: "chatgpt", email: "private@example.edu", planType: "pro" },
      requiresOpenaiAuth: true,
    },
    { checkedAt },
  );
  assert.deepEqual(result, {
    status: "READY",
    label: "Codex ready",
    detail: "The local Codex harness is available for Collect and targeted opportunity updates.",
    authentication: "ChatGPT managed sign-in",
    checkedAt,
    diagnosticCode: null,
  });
  assert.doesNotMatch(JSON.stringify(result), /private|example\.edu|pro/);
});

test("distinguishes required sign-in from an unavailable harness", () => {
  const authRequired = publicRuntimeReadiness(
    { account: null, requiresOpenaiAuth: true },
    { checkedAt },
  );
  assert.equal(authRequired.status, "AUTH_REQUIRED");
  assert.equal(authRequired.authentication, "Not signed in");

  const unavailable = unavailableRuntimeReadiness(
    Object.assign(new Error("private process details"), { code: "SPAWN_FAILED:private" }),
    { checkedAt },
  );
  assert.equal(unavailable.status, "UNAVAILABLE");
  assert.equal(unavailable.diagnosticCode, "SPAWN_FAILEDprivate");
  assert.doesNotMatch(JSON.stringify(unavailable), /private process details/);
});
