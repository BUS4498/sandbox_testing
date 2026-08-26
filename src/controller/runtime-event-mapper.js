const EXPLICIT_BUSINESS_STAGES = Object.freeze({
  RETRIEVING_PREFERENCES: "Retrieving Preferences",
  SEARCHING_WEB: "Searching the Web",
  REVIEWING_CANDIDATES: "Reviewing Candidates",
  RANKING_OPPORTUNITIES: "Ranking Opportunities",
  ASSESSING_FIT: "Assessing Fit",
  ACTING: "Acting",
  UPDATING_COLLECTION: "Updating Collection",
  PREPARING_WORD_DRAFT: "Preparing Word Draft",
  SENDING_NOTIFICATIONS: "Sending Notifications",
  VERIFYING: "Verifying",
  REMEMBERING: "Remembering",
  FINISHED: "Finished",
  NEEDS_ATTENTION: "Action required",
});

const STAGE_PROGRESS = Object.freeze({
  RETRIEVING_PREFERENCES: 8,
  SEARCHING_WEB: 20,
  REVIEWING_CANDIDATES: 36,
  RANKING_OPPORTUNITIES: 50,
  ASSESSING_FIT: 62,
  ACTING: 70,
  UPDATING_COLLECTION: 78,
  PREPARING_WORD_DRAFT: 82,
  SENDING_NOTIFICATIONS: 86,
  VERIFYING: 92,
  REMEMBERING: 97,
  FINISHED: 100,
  NEEDS_ATTENTION: 0,
});

/**
 * Translate observable App Server events into business-level UI states.
 * Reasoning content and agent-message deltas are deliberately ignored.
 */
export function mapRuntimeEvent(message) {
  const method = message?.method;
  const params = message?.params ?? {};

  if (method === "internship/stage") {
    const stage = String(params.stage ?? "").toUpperCase();
    if (!(stage in EXPLICIT_BUSINESS_STAGES)) return null;
    return businessState(stage, params.detail || EXPLICIT_BUSINESS_STAGES[stage]);
  }

  if (method === "turn/started") {
    return businessState("RETRIEVING_PREFERENCES", "Reading your verified preferences, saved response, and relevant local history.");
  }

  if (method === "turn/completed") {
    const status = String(params.turn?.status ?? "").toLowerCase();
    if (status === "completed") return businessState("FINISHED", "The Codex turn completed.");
    return businessState("NEEDS_ATTENTION", `The Codex turn ended with status ${status || "unknown"}.`);
  }

  if (method === "thread/status/changed") {
    const flags = params.status?.activeFlags ?? [];
    if (flags.includes("waitingOnApproval")) {
      return businessState("NEEDS_ATTENTION", "Codex is paused until you review the specific approval request shown below.");
    }
    return null;
  }

  if (method === "error" || method === "warning" || method === "configWarning") {
    return businessState("NEEDS_ATTENTION", "The workflow reported a specific issue. Review the action shown below before continuing.");
  }

  if (method !== "item/started" && method !== "item/completed") return null;
  const item = params.item ?? {};

  if (item.type === "webSearch") {
    const actionType = item.action?.type;
    return businessState(
      "SEARCHING_WEB",
      actionType === "search"
        ? "Searching public career pages for internships that match your verified preferences."
        : "Opening a promising result to confirm that the internship posting is current and legitimate.",
    );
  }

  if (["commandExecution", "fileChange", "dynamicToolCall", "mcpToolCall"].includes(item.type)) {
    const activity = observableActivityText(item);
    if (/context[\\/]|career-preferences|availability-and-constraints|is-junior-resume|student-profile/.test(activity)) {
      return businessState("RETRIEVING_PREFERENCES", "Reading the verified resume, career preferences, availability, and constraints needed for this run.");
    }
    if (/memory|state\.json|decisions\.jsonl|actions\.jsonl|observations\.jsonl|evaluations\.jsonl/.test(activity)) {
      return businessState("RETRIEVING_PREFERENCES", "Checking prior opportunity observations and actions so unchanged postings and duplicate work are not repeated.");
    }
    if (/spreadsheet|workbook|excel|collection|\.xlsx/.test(activity)) {
      return businessState("UPDATING_COLLECTION", "Updating the verified opportunity record in your local spreadsheet.");
    }
    if (/docx|word|application-material|cover-letter|resume-tailoring|question-worksheet/.test(activity)) {
      return businessState("PREPARING_WORD_DRAFT", "Creating a review-only Word application draft in the selected opportunity’s private local folder.");
    }
    if (/email|notification|outlook/.test(activity)) {
      return businessState("SENDING_NOTIFICATIONS", "Sending permitted informational updates to your saved notification address.");
    }
    if (/verify|check|confirm|read-back/.test(activity)) {
      return businessState("VERIFYING", "Checking that the intended spreadsheet, notification, and preparation actions actually succeeded.");
    }
    if (item.type === "fileChange") {
      return businessState("ACTING", "Preparing a local structured result for controller verification. No application or employer message is being sent.");
    }
    return businessState("ACTING", "Checking approved repository instructions and local workflow inputs needed for this stage. No application is being submitted.");
  }

  // Never map reasoning, plans, or message text into a more detailed status.
  return null;
}

export function publicRuntimeEvent(message) {
  const mapped = mapRuntimeEvent(message);
  if (!mapped) return null;
  return {
    type: "run.stage",
    stage: mapped.stage,
    label: mapped.label,
    detail: mapped.detail,
    progressPercent: mapped.progressPercent,
  };
}

function businessState(stage, detail) {
  return { stage, label: EXPLICIT_BUSINESS_STAGES[stage], detail, progressPercent: STAGE_PROGRESS[stage] ?? 0 };
}

function observableActivityText(item) {
  return [
    item.tool,
    item.appContext?.actionName,
    item.appContext?.appName,
    item.command,
    item.cwd,
    item.path,
    ...(Array.isArray(item.changes) ? item.changes.map((change) => change?.path ?? change?.filePath) : []),
  ].filter(Boolean).join(" ").toLowerCase();
}
