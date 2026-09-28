import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { LocalSettingsStore } from "../src/persistence/local-settings-store.js";

test("local settings persist a student email in private runtime storage and expose only a masked public value", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "internship-settings-test-"));
  const filePath = path.join(directory, "settings.json");
  try {
    const store = await new LocalSettingsStore({
      filePath,
      clock: () => new Date("2026-08-25T12:00:00.000Z"),
    }).initialize();
    assert.equal(await store.getNotificationEmail(), null);

    await store.setNotificationEmail("student@example.edu");
    assert.equal(await store.getNotificationEmail(), "student@example.edu");
    const snapshot = await store.publicNotificationSettings({ mode: "DRY_RUN" });
    assert.equal(snapshot.configured, true);
    assert.equal(snapshot.recipientHint, "st*****@example.edu");
    assert.equal(snapshot.deliveryStatus, "LOCAL_PREVIEW_ONLY");
    assert.doesNotMatch(JSON.stringify(snapshot), /student@example\.edu/);
    assert.match(await readFile(filePath, "utf8"), /student@example\.edu/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("local settings reject malformed notification addresses", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "internship-settings-test-"));
  try {
    const store = await new LocalSettingsStore({ filePath: path.join(directory, "settings.json") }).initialize();
    await assert.rejects(store.setNotificationEmail("not-an-email"), /valid student notification email/);
    await assert.rejects(store.setNotificationEmail("student@example.edu\nBCC:other@example.edu"), /valid student notification email/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("local settings persist a validated daily collection schedule", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "internship-settings-test-"));
  try {
    const store = await new LocalSettingsStore({ filePath: path.join(directory, "settings.json") }).initialize();
    assert.deepEqual(await store.getSchedule(), {
      enabled: false, time: "09:00", updatedAt: null, lastScheduledFor: null,
      lastRun: null, lastOutcome: null, missedRun: null,
    });
    const saved = await store.setSchedule({ enabled: true, time: "14:35" });
    assert.equal(saved.enabled, true);
    assert.equal(saved.time, "14:35");
    await assert.rejects(store.setSchedule({ enabled: true, time: "25:00" }), /valid local daily time/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
