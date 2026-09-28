import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  browserLaunchCommand,
  dashboardIsReady,
  isOutdatedDashboard,
  parseLauncherPort,
  stopOutdatedDashboard,
  waitForDashboard,
} from "../scripts/launch-local-app.js";
import { DASHBOARD_API_VERSION } from "../src/server/runtime-metadata.js";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("launcher validates the local dashboard rather than trusting an occupied port", async () => {
  const healthy = await dashboardIsReady("http://127.0.0.1:4318", {
    fetchImpl: async () => ({
      ok: true,
      async json() {
        return {
          status: "ok",
          local: true,
          applicationId: "internship-application-prep-agent",
          runtime: "openai-responses-api",
          apiVersion: DASHBOARD_API_VERSION,
        };
      },
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

  const legacy = await dashboardIsReady("http://127.0.0.1:4318", {
    fetchImpl: async () => ({
      ok: true,
      async json() { return { status: "ok", local: true }; },
    }),
  });
  assert.equal(legacy, false);
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
        async json() {
          return {
            status: "ok",
            local: true,
            applicationId: "internship-application-prep-agent",
            runtime: "openai-responses-api",
            apiVersion: DASHBOARD_API_VERSION,
          };
        },
      };
    },
  });

  assert.equal(ready, true);
  assert.equal(checks, 3);
});

test("launcher identifies and safely stops only an idle outdated app process", async () => {
  const outdated = {
    reachable: true,
    compatible: false,
    body: {
      status: "ok",
      local: true,
      applicationId: "internship-application-prep-agent",
      runtime: "openai-responses-api",
      apiVersion: DASHBOARD_API_VERSION - 1,
      processId: 24680,
      restartSafe: true,
    },
  };
  const signals = [];
  assert.equal(isOutdatedDashboard(outdated), true);
  assert.equal(await stopOutdatedDashboard(outdated, {
    killImpl: (...args) => signals.push(args),
    sleep: async () => {},
  }), true);
  assert.deepEqual(signals, [[24680, "SIGTERM"]]);

  assert.equal(await stopOutdatedDashboard({
    ...outdated,
    body: { ...outdated.body, restartSafe: false },
  }, {
    killImpl: (...args) => signals.push(args),
    sleep: async () => {},
  }), false);
  assert.equal(signals.length, 1);
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
