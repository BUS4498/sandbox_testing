import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { loadLocalEnvironment } from "../src/config/local-env.js";

test("loads only recognized local configuration without overwriting the process environment", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "internship-env-test-"));
  const filePath = path.join(directory, ".env");
  const target = { NOTIFICATION_EMAIL: "existing@example.edu" };
  try {
    await writeFile(filePath, "NOTIFICATION_EMAIL=replaced@example.edu\nEMAIL_NOTIFICATIONS_MODE=DRY_RUN\nUNKNOWN_KEY=ignored\n", "utf8");
    const result = await loadLocalEnvironment(filePath, { target });
    assert.equal(target.NOTIFICATION_EMAIL, "existing@example.edu");
    assert.equal(target.EMAIL_NOTIFICATIONS_MODE, "DRY_RUN");
    assert.equal("UNKNOWN_KEY" in target, false);
    assert.deepEqual(result.keys, ["EMAIL_NOTIFICATIONS_MODE"]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
test("does not execute environment interpolation or command syntax", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "internship-env-test-"));
  const filePath = path.join(directory, ".env");
  try {
    await writeFile(filePath, "NOTIFICATION_EMAIL=$(whoami)\n", "utf8");
    await assert.rejects(loadLocalEnvironment(filePath, { target: {} }), /not supported/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
