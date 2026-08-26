import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  browserLaunchCommand,
  dashboardIsReady,
  parseLauncherPort,
  waitForDashboard,
} from "../scripts/launch-local-app.js";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

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
    command: "explorer.exe",
    args: ["http://127.0.0.1:4318"],
  });
});

test("Windows double-click launcher opens the verified dashboard from the batch process", async () => {
  const batch = await readFile(path.join(repositoryRoot, "Start Internship App.cmd"), "utf8");
  assert.match(batch, /launch-local-app\.js --no-open/);
  assert.match(batch, /start "" "http:\/\/127\.0\.0\.1:%APP_PORT%\/"/);
  assert.match(batch, /Copy this address into your browser/);
});
