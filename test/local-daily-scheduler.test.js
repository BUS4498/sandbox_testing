import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { OperationalMemoryStore } from "../src/persistence/operational-memory-store.js";
import { LocalSettingsStore } from "../src/persistence/local-settings-store.js";
import { LocalDailyScheduler, nextOccurrence } from "../src/schedule/local-daily-scheduler.js";

class FakeRunManager extends EventEmitter {
  constructor() { super(); this.calls = []; this.setupReady = true; }
  async checkStudentSetupReadiness() {
    return this.setupReady
      ? { ready: true, missingItems: [] }
      : { ready: false, missingItems: ["Upload and confirm a resume"] };
  }
  startCollection(options) {
    this.calls.push(options);
    return { runId: "scheduled-run-1", startedAt: "2026-09-25T16:00:00.000Z" };
  }
}

test("computes the next local occurrence without inventing an immediate run", () => {
  const now = new Date(2026, 8, 25, 10, 0, 0);
  const next = nextOccurrence("09:00", now);
  assert.equal(next.getDate(), 26);
  assert.equal(next.getHours(), 9);
});

test("scheduled collection is skipped before any workflow when student setup is incomplete", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "internship-scheduler-setup-test-"));
  const now = new Date(2026, 8, 25, 8, 0, 0);
  let scheduledTimer;
  try {
    const settingsStore = await new LocalSettingsStore({ filePath: path.join(directory, "settings.json"), clock: () => now }).initialize();
    await settingsStore.setSchedule({ enabled: true, time: "09:00" });
    const memoryStore = await new OperationalMemoryStore({ rootDir: path.join(directory, "memory"), clock: () => now }).initialize();
    const runManager = new FakeRunManager();
    runManager.setupReady = false;
    const scheduler = await new LocalDailyScheduler({
      settingsStore, memoryStore, runManager, clock: () => now,
      setTimer: (callback, delay) => { scheduledTimer = { callback, delay, unref() {} }; return scheduledTimer; },
      clearTimer: () => {},
    }).initialize();
    await scheduledTimer.callback();
    assert.equal(runManager.calls.length, 0);
    assert.equal((await settingsStore.getSchedule()).lastOutcome, "NEEDS_STUDENT_SETUP");
    await scheduler.close();
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("enabled local schedule invokes the same collection entry point with a scheduled trigger", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "internship-scheduler-test-"));
  const now = new Date(2026, 8, 25, 8, 0, 0);
  let scheduledTimer;
  try {
    const settingsStore = await new LocalSettingsStore({ filePath: path.join(directory, "settings.json"), clock: () => now }).initialize();
    await settingsStore.setSchedule({ enabled: true, time: "09:00" });
    const memoryStore = await new OperationalMemoryStore({ rootDir: path.join(directory, "memory"), clock: () => now }).initialize();
    const runManager = new FakeRunManager();
    const scheduler = await new LocalDailyScheduler({
      settingsStore, memoryStore, runManager, clock: () => now,
      setTimer: (callback, delay) => { scheduledTimer = { callback, delay, unref() {} }; return scheduledTimer; },
      clearTimer: () => {},
    }).initialize();
    assert.equal((await scheduler.snapshot()).status, "ENABLED");
    assert.ok(scheduledTimer.delay > 0);
    await scheduledTimer.callback();
    assert.deepEqual(runManager.calls, [{ trigger: "SCHEDULED" }]);
    assert.equal((await settingsStore.getSchedule()).lastOutcome, "IN_PROGRESS");
    await scheduler.close();
  } finally { await rm(directory, { recursive: true, force: true }); }
});
