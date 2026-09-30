import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { collectAllowanceSnapshot, INSERT_OWNER_COLLECTION_ADMISSION_SQL, INSERT_USAGE_ADMISSION_SQL, isUnlimitedCollectOwner, OWNER_COLLECTION_USAGE_GROUP, ownerCollectAllowance, RUN_USAGE_LIMITS, retryAfter, usageWindowStart } from "../lib/hosted/usage-policy.js";

function database() {
  const db = new DatabaseSync(":memory:");
  db.exec("CREATE TABLE usage_admissions (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, kind TEXT NOT NULL, usage_group TEXT NOT NULL, started_at TEXT NOT NULL); CREATE TABLE runs (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL);");
  return db;
}
function admit(db, ownerId, kind, now) {
  const policy = RUN_USAGE_LIMITS[kind];
  const since = usageWindowStart(now);
  return db.prepare(INSERT_USAGE_ADMISSION_SQL).run(crypto.randomUUID(), ownerId, kind, policy.group, now.toISOString(), ownerId, kind, since, policy.perStudent, policy.group, since, policy.siteWide).changes === 1;
}

test("one signed-in student's Collect starts are limited to five per rolling 24 hours", () => {
  const db = database();
  const now = new Date("2026-09-29T18:00:00.000Z");
  assert.equal(admit(db, "synthetic-student-a", "COLLECTION", now), true);
  assert.equal(admit(db, "synthetic-student-a", "COLLECTION", new Date(now.getTime() + 60_000)), true);
  assert.equal(admit(db, "synthetic-student-a", "COLLECTION", new Date(now.getTime() + 120_000)), true);
  assert.equal(admit(db, "synthetic-student-a", "COLLECTION", new Date(now.getTime() + 180_000)), true);
  assert.equal(admit(db, "synthetic-student-a", "COLLECTION", new Date(now.getTime() + 240_000)), true);
  assert.equal(admit(db, "synthetic-student-a", "COLLECTION", new Date(now.getTime() + 300_000)), false);
  assert.equal(admit(db, "synthetic-student-b", "COLLECTION", now), true);
  assert.equal(admit(db, "synthetic-student-a", "COLLECTION", new Date(now.getTime() + 24 * 60 * 60 * 1000 + 1)), true);
  assert.equal(retryAfter(now.toISOString()), "2026-09-30T18:00:00.000Z");
  db.close();
});

test("remaining Collect allowance is a server-count snapshot with a clear exhausted state", () => {
  const oldest = "2026-09-29T18:00:00.000Z";
  const empty = collectAllowanceSnapshot({ student: { count: 0, oldest: null }, site: { count: 0, oldest: null } });
  assert.deepEqual([empty.allowed, empty.remainingStudent, empty.remainingSite, empty.perStudentLimit], [true, 5, 60, 5]);
  const partial = collectAllowanceSnapshot({ student: { count: 1, oldest }, site: { count: 1, oldest } });
  assert.deepEqual([partial.allowed, partial.remainingStudent, partial.remainingSite], [true, 4, 59]);
  const priorLimit = collectAllowanceSnapshot({ student: { count: 3, oldest }, site: { count: 3, oldest } });
  assert.deepEqual([priorLimit.allowed, priorLimit.remainingStudent], [true, 2]);
  const personalLimit = collectAllowanceSnapshot({ student: { count: 5, oldest }, site: { count: 5, oldest } });
  assert.equal(personalLimit.allowed, false);
  assert.equal(personalLimit.remainingStudent, 0);
  assert.equal(personalLimit.retryAt, "2026-09-30T18:00:00.000Z");
  const siteLimit = collectAllowanceSnapshot({ student: { count: 1, oldest }, site: { count: 60, oldest } });
  assert.equal(siteLimit.allowed, false);
  assert.equal(siteLimit.remainingStudent, 4);
  assert.equal(siteLimit.remainingSite, 0);
});

test("60 student Collect starts exhaust the site-wide window, without a reset bypass", () => {
  const db = database();
  const now = new Date("2026-09-29T18:00:00.000Z");
  for (let index = 0; index < 60; index++) assert.equal(admit(db, `synthetic-student-${index}`, "COLLECTION", now), true);
  db.exec("DELETE FROM runs"); // Reset Collection clears runs, not admissions.
  assert.equal(admit(db, "synthetic-student-61", "COLLECTION", now), false);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM usage_admissions").get().count, 60);
  db.close();
});

test("owner exemption requires an exact, configured, authenticated account ID", () => {
  assert.equal(isUnlimitedCollectOwner("synthetic-owner", "synthetic-owner"), true);
  assert.equal(isUnlimitedCollectOwner("synthetic-student", "synthetic-owner"), false);
  assert.equal(isUnlimitedCollectOwner("synthetic-owner", undefined), false);
  assert.equal(isUnlimitedCollectOwner("synthetic-owner", ""), false);
  assert.equal(isUnlimitedCollectOwner("", "synthetic-owner"), false);
  assert.equal(isUnlimitedCollectOwner("synthetic-owner@example.edu", "synthetic-owner"), false);
  assert.deepEqual(ownerCollectAllowance(), { allowed: true, ownerUnlimited: true, retryAt: null, reason: "", remainingStudent: null, remainingSite: null, perStudentLimit: null });
});

test("owner Collect starts stay auditable and do not consume student start slots", () => {
  const db = database();
  const now = new Date("2026-09-29T18:00:00.000Z");
  const ownerStatement = db.prepare(INSERT_OWNER_COLLECTION_ADMISSION_SQL);
  for (let index = 0; index < 65; index++) {
    const result = ownerStatement.run(crypto.randomUUID(), "synthetic-owner", "COLLECTION", OWNER_COLLECTION_USAGE_GROUP, now.toISOString());
    assert.equal(result.changes, 1);
  }
  for (let index = 0; index < 60; index++) assert.equal(admit(db, `synthetic-student-${index}`, "COLLECTION", now), true);
  assert.equal(admit(db, "synthetic-student-61", "COLLECTION", now), false);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM usage_admissions WHERE usage_group='OWNER_COLLECTION'").get().count, 65);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM usage_admissions WHERE usage_group='COLLECTION'").get().count, 60);
  db.close();
});

test("secondary actions have per-student and shared site-wide ceilings", () => {
  const db = database();
  const now = new Date("2026-09-29T18:00:00.000Z");
  for (let index = 0; index < 5; index++) assert.equal(admit(db, "synthetic-student-a", "MATERIAL_PREP", now), true);
  assert.equal(admit(db, "synthetic-student-a", "MATERIAL_PREP", now), false);
  for (let index = 0; index < 95; index++) assert.equal(admit(db, `synthetic-student-${index}`, "TARGETED_UPDATE", now), true);
  assert.equal(admit(db, "another-student", "INTERVIEW_PRACTICE", now), false);
  db.close();
});
