import assert from "node:assert/strict";
import test from "node:test";

import {
  browserLaunchCommand,
  dashboardIsReady,
  parseLauncherPort,
  waitForDashboard,
} from "../scripts/launch-local-app.js";

test("launcher validates the local dashboard rather than trusting an occupied port", async () => {
  const healthy = await dashboardIsReady("http://127.0.0.1:4318", {
    fetchImpl: async () => ({
      ok: true,
      async json() { return { status: "ok", local: true }; },
    }),
  });
  const unrelated = await dashboardIsReady("http://127.0.0.1:4318", {
    fetchImpl: async () => ({
      ok: true,
      async json() { return { status: "ok" }; },
    }),
  });

  assert.equal(healthy, true);
  assert.equal(unrelated, false);
});

test("launcher waits for a newly started dashboard", async () => {
  let checks = 0;
  const ready = await waitForDashboard("http://127.0.0.1:4318", {
    attempts: 3,
    intervalMs: 0,
    sleep: async () => {},
    fetchImpl: async () => {
      checks += 1;
      if (checks < 3) throw new Error("not ready");
      return {
        ok: true,
        async json() { return { status: "ok", local: true }; },
      };
    },
  });

  assert.equal(ready, true);
  assert.equal(checks, 3);
});

test("launcher avoids the PowerShell npm script path on Windows", () => {
  assert.equal(parseLauncherPort("4318"), 4318);
  assert.throws(() => parseLauncherPort("0"), /Invalid PORT/);
  assert.deepEqual(browserLaunchCommand("http://127.0.0.1:4318", "win32"), {
    command: "cmd.exe",
    args: ["/d", "/s", "/c", 'start "" "http://127.0.0.1:4318"'],
  });
});
