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

/** Translate controller-owned stage events into business-level UI states. */
export function mapRuntimeEvent(message) {
  const method = message?.method;
  const params = message?.params ?? {};

  if (method === "internship/stage") {
    const stage = String(params.stage ?? "").toUpperCase();
    if (!(stage in EXPLICIT_BUSINESS_STAGES)) return null;
    return businessState(stage, params.detail || EXPLICIT_BUSINESS_STAGES[stage]);
  }

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
