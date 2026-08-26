import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { composeStudentUpdateEmail } from "../src/notifications/email-template.js";
import { NotificationPolicyError, StudentEmailNotifier } from "../src/notifications/student-email-notifier.js";
import { OperationalMemoryStore } from "../src/persistence/operational-memory-store.js";

async function withNotifier(run, options = {}) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "internship-email-test-"));
  const memoryStore = await new OperationalMemoryStore({
    rootDir: path.join(directory, "memory"),
    clock: () => new Date("2026-08-25T12:00:00.000Z"),
  }).initialize();
  const notifier = new StudentEmailNotifier({
    recipient: "student@example.edu",
    memoryStore,
    outboxDir: path.join(directory, "outbox"),
    clock: () => new Date("2026-08-25T12:00:00.000Z"),
    idFactory: (() => {
      let counter = 0;
      return () => `message-${++counter}`;
    })(),
    ...options,
  });
  try {
    await run({ notifier, memoryStore, directory });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

function eligibleUpdate(overrides = {}) {
  return {
    runId: "run-001",
    opportunityId: "opp-001",
    materialUpdateId: "update-001",
    idempotencyKey: "email:run-001:update-001",
    spreadsheetVerification: { success: true },
    materialChange: true,
    updateDisposition: "NEW",
    candidateClassification: "ACTIVE",
    updateType: "NEW_OPPORTUNITY",
    company: "Northstar Retail Analytics",
    roleTitle: "Information Systems Intern",
    whatChanged: "A new verified opportunity was added.",
    deadline: "2026-10-15",
    agentDecision: "PRIORITIZE",
    rationale: "The required coursework aligns with the verified student profile.",
    nextAction: "Review the posting and prepare application materials.",
    attentionRequired: true,
    ...overrides,
  };
}

test("routine email content is deterministic and excludes profile details", () => {
  const message = composeStudentUpdateEmail(eligibleUpdate());
  assert.match(message.subject, /New opportunity/);
  assert.match(message.text, /Northstar Retail Analytics/);
  assert.match(message.text, /No application or employer communication was sent/);
  assert.doesNotMatch(message.text, /resume|student name/i);
});

test("dry-run creates a local preview and records verified memory without sending", async () => {
  await withNotifier(async ({ notifier, memoryStore, directory }) => {
    const result = await notifier.notifyMaterialUpdate(eligibleUpdate());
    assert.equal(result.status, "DRY_RUN");
    assert.match(result.recipientHint, /^st\*+@example\.edu$/);

    const files = await readdir(path.join(directory, "outbox"));
    assert.equal(files.length, 1);
    const preview = JSON.parse(await readFile(path.join(directory, "outbox", files[0]), "utf8"));
    assert.equal(preview.to, "student@example.edu");

    const [action] = await memoryStore.list("action");
    assert.equal(action.outcome, "DRY_RUN");
    assert.equal(action.recipientHint, result.recipientHint);
    assert.equal("to" in action, false);
    assert.equal((await memoryStore.list("evaluation"))[0].outcome, "SUCCESS");
  });
});

test("rejects unverified, unchanged, duplicate, and invalid opportunities", async () => {
  await withNotifier(async ({ notifier }) => {
    await assert.rejects(
      notifier.notifyMaterialUpdate(eligibleUpdate({ spreadsheetVerification: { success: false } })),
      NotificationPolicyError,
    );
    await assert.rejects(
      notifier.notifyMaterialUpdate(
        eligibleUpdate({ materialChange: false, updateDisposition: "EXISTING_UNCHANGED" }),
      ),
      /Only a new or materially changed/,
    );
    await assert.rejects(
      notifier.notifyMaterialUpdate(eligibleUpdate({ candidateClassification: "DUPLICATE" })),
      /not eligible for email/,
    );
    await assert.rejects(
      notifier.notifyMaterialUpdate(eligibleUpdate({ candidateClassification: "INVALID" })),
      /not eligible for email/,
    );
  });
});

test("idempotency prevents repeated previews or sends for the same update", async () => {
  await withNotifier(async ({ notifier, directory }) => {
    const first = await notifier.notifyMaterialUpdate(eligibleUpdate());
    const second = await notifier.notifyMaterialUpdate(eligibleUpdate());
    assert.equal(first.status, "DRY_RUN");
    assert.equal(second.status, "SKIPPED_DUPLICATE");
    assert.equal((await readdir(path.join(directory, "outbox"))).length, 1);
  });
});

test("enforces the maximum of five opportunity notifications per run", async () => {
  await withNotifier(async ({ notifier }) => {
    for (let index = 1; index <= 5; index += 1) {
      const result = await notifier.notifyMaterialUpdate(
        eligibleUpdate({
          opportunityId: `opp-00${index}`,
          materialUpdateId: `update-00${index}`,
          idempotencyKey: `email:run-001:update-00${index}`,
        }),
      );
      assert.equal(result.status, "DRY_RUN");
    }
    const sixth = await notifier.notifyMaterialUpdate(
      eligibleUpdate({
        opportunityId: "opp-006",
        materialUpdateId: "update-006",
        idempotencyKey: "email:run-001:update-006",
      }),
    );
    assert.equal(sixth.status, "BLOCKED_RUN_LIMIT");
  });
});

test("live mode works only through an explicitly injected approved transport", async () => {
  const sent = [];
  const transport = {
    async send(message) {
      sent.push(message);
      return { status: "SUBMITTED", providerReceipt: "synthetic-receipt-001" };
    },
  };
  await withNotifier(
    async ({ notifier, memoryStore }) => {
      const result = await notifier.notifyMaterialUpdate(eligibleUpdate());
      assert.equal(result.status, "SUBMITTED");
      assert.equal(sent.length, 1);
      assert.equal(sent[0].to, "student@example.edu");
      assert.equal((await memoryStore.list("action"))[0].outcome, "SUBMITTED");
    },
    { mode: "LIVE", transport },
  );
});

test("Outlook mode submits one bounded batch without asking a model to compose routine messages", async () => {
  const batches = [];
  const transport = {
    async sendBatch(messages) {
      batches.push(messages);
      return messages.map((_, index) => ({ status: "SUBMITTED", providerReceipt: `outlook-${index + 1}` }));
    },
  };
  await withNotifier(
    async ({ notifier, memoryStore }) => {
      const results = await notifier.notifyMaterialUpdates([
        eligibleUpdate(),
        eligibleUpdate({ opportunityId: "opp-002", materialUpdateId: "update-002", idempotencyKey: "email:run-001:update-002", company: "Contoso Analytics" }),
      ]);
      assert.deepEqual(results.map((item) => item.status), ["SUBMITTED", "SUBMITTED"]);
      assert.equal(batches.length, 1);
      assert.equal(batches[0].length, 2);
      assert.equal(batches[0][0].to, "student@example.edu");
      assert.match(batches[0][0].text, /No application or employer communication was sent/);
      assert.equal((await memoryStore.list("action")).every((entry) => entry.transport === "CODEX_OUTLOOK_APP"), true);
    },
    { mode: "OUTLOOK", transport },
  );
});

test("header injection is rejected before an outbox or provider action", async () => {
  await withNotifier(async ({ notifier, memoryStore }) => {
    await assert.rejects(
      notifier.notifyMaterialUpdate(eligibleUpdate({ company: "Example Corp\r\nBcc: attacker@example.com" })),
      /must not contain line breaks/,
    );
    assert.equal((await memoryStore.list("action")).length, 0);
  });
});
