import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { composeStudentUpdateEmail } from "./email-template.js";

const ALLOWED_DISPOSITIONS = new Set(["NEW", "MATERIALLY_CHANGED"]);
const BLOCKED_CLASSIFICATIONS = new Set([
  "DUPLICATE",
  "EXISTING_UNCHANGED",
  "INVALID",
  "INCOMPLETE",
  "FILTERED_OUT",
]);
const COMPLETED_NOTIFICATION_OUTCOMES = new Set(["PREVIEWED", "SUBMITTED", "DELIVERED"]);
const LIVE_PROVIDER_STATUSES = new Set(["SUBMITTED", "DELIVERED", "FAILED", "UNKNOWN"]);
const MAX_NOTIFICATIONS_PER_RUN = 5;

export class NotificationPolicyError extends Error {
  constructor(message, code) {
    super(message);
    this.name = "NotificationPolicyError";
    this.code = code;
  }
}

export class StudentEmailNotifier {
  #queue = Promise.resolve();

  constructor({
    recipient,
    memoryStore,
    outboxDir,
    mode = "DRY_RUN",
    transport,
    clock = () => new Date(),
    idFactory = randomUUID,
  }) {
    this.recipient = validateEmailAddress(recipient);
    if (!memoryStore) throw new TypeError("StudentEmailNotifier requires an operational memory store.");
    if (!outboxDir) throw new TypeError("StudentEmailNotifier requires outboxDir.");
    this.memoryStore = memoryStore;
    this.outboxDir = path.resolve(outboxDir);
    this.mode = String(mode).toUpperCase();
    this.transport = transport;
    this.clock = clock;
    this.idFactory = idFactory;

    if (!new Set(["DRY_RUN", "LIVE"]).has(this.mode)) {
      throw new TypeError(`Unsupported notification mode: ${mode}.`);
    }
    if (this.mode === "LIVE" && typeof transport?.send !== "function") {
      throw new TypeError("LIVE notification mode requires an approved transport with a send method.");
    }
  }

  notifyMaterialUpdate(input, { retry = false } = {}) {
    return this.#enqueue(() => this.#notifyMaterialUpdate(input, { retry }));
  }

  notifyMaterialUpdates(inputs, { retry = false } = {}) {
    if (!Array.isArray(inputs) || inputs.length > MAX_NOTIFICATIONS_PER_RUN) {
      throw new TypeError("A notification batch must contain no more than five updates.");
    }
    return Promise.all(inputs.map((input) => this.notifyMaterialUpdate(input, { retry })));
  }

  async #notifyMaterialUpdate(input, { retry }) {
    validateEligibility(input);
    const priorActions = await this.memoryStore.list("action", { runId: input.runId });
    const priorForKey = priorActions
      .filter((entry) => entry.actionType === "STUDENT_UPDATE_NOTIFICATION")
      .findLast((entry) => entry.idempotencyKey === input.idempotencyKey);

    if (priorForKey && (COMPLETED_NOTIFICATION_OUTCOMES.has(priorForKey.outcome) || !retry)) {
      return {
        status: "SKIPPED_DUPLICATE",
        messageAttemptId: priorForKey.messageAttemptId,
        idempotencyKey: input.idempotencyKey,
        reason: "This material update already has a recorded notification attempt.",
      };
    }

    const countedUpdates = new Set(
      priorActions
        .filter((entry) => entry.actionType === "STUDENT_UPDATE_NOTIFICATION")
        .filter((entry) => entry.outcome !== "SKIPPED_DUPLICATE")
        .map((entry) => entry.materialUpdateId),
    );
    if (!countedUpdates.has(input.materialUpdateId) && countedUpdates.size >= MAX_NOTIFICATIONS_PER_RUN) {
      const issue = {
        status: "BLOCKED_RUN_LIMIT",
        reason: `The approved maximum of ${MAX_NOTIFICATIONS_PER_RUN} opportunity-update emails was reached.`,
        nextAction: "Surface the unsent update in the dashboard and review it in a later run.",
      };
      await this.memoryStore.appendEvaluation({
        runId: input.runId,
        opportunityId: input.opportunityId,
        expectedOutcome: "Send no more than five student update notifications in one discovery run.",
        observedOutcome: issue.reason,
        outcome: "PARTIAL SUCCESS",
        unresolvedIssue: "A selected material update was not emailed because the per-run notification limit was reached.",
        recommendedCorrectiveAction: issue.nextAction,
      });
      return issue;
    }

    const messageAttemptId = this.idFactory();
    const message = composeStudentUpdateEmail(input);
    const attemptedAt = this.clock().toISOString();
    let result;

    if (this.mode === "DRY_RUN") {
      await mkdir(this.outboxDir, { recursive: true });
      const previewPath = path.join(this.outboxDir, `${safeFilePart(messageAttemptId)}.json`);
      await writeFile(
        previewPath,
        `${JSON.stringify(
          {
            messageAttemptId,
            mode: "DRY_RUN",
            to: this.recipient,
            subject: message.subject,
            text: message.text,
            createdAt: attemptedAt,
          },
          null,
          2,
        )}\n`,
        { encoding: "utf8", flag: "wx" },
      );
      result = { status: "PREVIEWED", previewPath, providerReceipt: null };
    } else {
      result = await this.#sendLive({ input, message, messageAttemptId });
    }

    const action = await this.memoryStore.appendAction({
      runId: input.runId,
      opportunityId: input.opportunityId,
      materialUpdateId: input.materialUpdateId,
      actionType: "STUDENT_UPDATE_NOTIFICATION",
      idempotencyKey: input.idempotencyKey,
      messageAttemptId,
      recipientHint: maskEmailAddress(this.recipient),
      attemptedAt,
      outcome: result.status,
      providerReceipt: result.providerReceipt ?? null,
    });

    await this.memoryStore.appendEvaluation({
      runId: input.runId,
      opportunityId: input.opportunityId,
      expectedOutcome:
        this.mode === "DRY_RUN"
          ? "Create a safe local preview without sending an external email."
          : "Submit one informational update email to the configured student address.",
      observedOutcome: notificationOutcomeDescription(result.status),
      outcome: evaluationOutcome(result.status),
      unresolvedIssue:
        ["FAILED", "UNKNOWN"].includes(result.status)
          ? "The informational student notification was not confirmed."
          : null,
      recommendedCorrectiveAction:
        ["FAILED", "UNKNOWN"].includes(result.status)
          ? "Review provider configuration and retry once with the same idempotency key."
          : null,
    });

    return {
      ...result,
      messageAttemptId,
      idempotencyKey: input.idempotencyKey,
      attemptedAt,
      recipientHint: maskEmailAddress(this.recipient),
      actionMemoryId: action.memoryId,
    };
  }

  async #sendLive({ input, message, messageAttemptId }) {
    try {
      const providerResult = await this.transport.send({
        to: this.recipient,
        subject: message.subject,
        text: message.text,
        headers: {
          "X-Internship-Run-ID": cleanHeader(input.runId),
          "X-Internship-Update-ID": cleanHeader(input.materialUpdateId),
          "X-Message-Attempt-ID": cleanHeader(messageAttemptId),
        },
      });
      const status = String(providerResult?.status ?? "UNKNOWN").toUpperCase();
      if (!LIVE_PROVIDER_STATUSES.has(status)) {
        return { status: "UNKNOWN", providerReceipt: providerResult?.providerReceipt ?? null };
      }
      return { status, providerReceipt: providerResult?.providerReceipt ?? null };
    } catch (error) {
      return {
        status: "FAILED",
        providerReceipt: null,
        error: { name: error?.name || "Error", code: safeErrorCode(error?.code) },
      };
    }
  }

  #enqueue(operation) {
    const queued = this.#queue.then(operation, operation);
    this.#queue = queued.catch(() => undefined);
    return queued;
  }
}

function validateEligibility(input) {
  for (const key of ["runId", "opportunityId", "materialUpdateId", "idempotencyKey"]) {
    if (!input?.[key]) throw new NotificationPolicyError(`${key} is required.`, "MISSING_INPUT");
  }
  if (input.spreadsheetVerification?.success !== true) {
    throw new NotificationPolicyError(
      "A student notification requires a successful spreadsheet read-back verification.",
      "SPREADSHEET_NOT_VERIFIED",
    );
  }
  if (input.materialChange !== true || !ALLOWED_DISPOSITIONS.has(input.updateDisposition)) {
    throw new NotificationPolicyError(
      "Only a new or materially changed opportunity may trigger a student notification.",
      "NOT_MATERIAL",
    );
  }
  if (BLOCKED_CLASSIFICATIONS.has(String(input.candidateClassification).toUpperCase())) {
    throw new NotificationPolicyError(
      `Candidate classification ${input.candidateClassification} is not eligible for email.`,
      "INELIGIBLE_CANDIDATE",
    );
  }
}

function validateEmailAddress(value) {
  const email = String(value ?? "").trim();
  if (/\r|\n/.test(email) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new TypeError("A valid configured student notification address is required.");
  }
  return email;
}

function maskEmailAddress(email) {
  const [local, domain] = email.split("@");
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${"*".repeat(Math.max(1, local.length - visible.length))}@${domain}`;
}

function cleanHeader(value) {
  const text = String(value);
  if (/\r|\n/.test(text)) throw new TypeError("Email header metadata must not contain line breaks.");
  return text.replace(/[^A-Za-z0-9._:-]/g, "-").slice(0, 120);
}

function safeFilePart(value) {
  return String(value).replace(/[^A-Za-z0-9._-]/g, "-");
}

function safeErrorCode(value) {
  if (value === null || value === undefined) return null;
  return String(value).replace(/[^A-Za-z0-9_-]/g, "").slice(0, 40) || null;
}

function evaluationOutcome(status) {
  if (["PREVIEWED", "SUBMITTED", "DELIVERED"].includes(status)) return "SUCCESS";
  if (status === "UNKNOWN") return "PARTIAL SUCCESS";
  return "FAILURE";
}

function notificationOutcomeDescription(status) {
  const descriptions = {
    PREVIEWED: "A local notification preview was created; no external email was sent.",
    SUBMITTED: "The provider accepted the informational email for delivery.",
    DELIVERED: "The provider reported delivery of the informational email.",
    UNKNOWN: "The provider outcome could not be confirmed.",
    FAILED: "The notification attempt failed without changing the spreadsheet record.",
  };
  return descriptions[status] ?? "The notification outcome was not recognized.";
}
