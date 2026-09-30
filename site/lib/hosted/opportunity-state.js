/** @typedef {import("./store").OpportunityRecord} OpportunityRecord */
/** @typedef {import("./store").StudentSetup} StudentSetup */
/** @typedef {import("./materials-store").MaterialRecord} MaterialRecord */

/** An assessment belongs to the exact confirmed setup, not just REAL/demo mode. */
/** @param {OpportunityRecord} record @param {Pick<StudentSetup, "mode" | "confirmedAt"> | null | undefined} setup */
export function assessmentMatchesSetup(record, setup) {
  if (!setup?.mode || setup.mode === "UNSELECTED") return false;
  if ((record.assessmentProfileMode ?? "SYNTHETIC_DEMONSTRATION") !== setup.mode) return false;
  if (!setup.confirmedAt) return true; // Visual preview and legacy fixtures only.
  if (Object.hasOwn(record, "assessmentProfileConfirmedAt")) return record.assessmentProfileConfirmedAt === setup.confirmedAt;
  // Older records predate the explicit profile-version field. A review before
  // the current confirmation cannot safely be attributed to this resume.
  const confirmed = Date.parse(setup.confirmedAt);
  const reviewed = Date.parse(record.lastAgentReview || "");
  return Number.isFinite(confirmed) && Number.isFinite(reviewed) && reviewed >= confirmed;
}

/** @param {OpportunityRecord} record */
export function studentResponseNeeded(record) {
  return Boolean(record.attentionRequired && record.nextActionRequest?.prompt?.trim()
    && record.nextActionRequest.responseType !== "NONE"
    && !/^no student response is requested\b/i.test(record.nextActionRequest.prompt.trim()));
}

/** @param {OpportunityRecord} record */
export function sourceCheckPending(record) {
  return record.postingStatus === "UNCERTAIN" && !studentResponseNeeded(record);
}

/** @param {string} action */
export function cleanNextAction(action) {
  return String(action ?? "").replace(/^\s*No student response is requested\.?(?:\s+|$)/i, "").trim();
}

/** @param {MaterialRecord} material @param {Pick<StudentSetup, "mode" | "confirmedAt">} setup */
export function materialMatchesSetup(material, setup) {
  if (material.profileMode !== setup.mode) return false;
  if (!setup.confirmedAt) return true;
  const created = Date.parse(material.createdAt);
  const confirmed = Date.parse(setup.confirmedAt);
  return Number.isFinite(created) && Number.isFinite(confirmed) && created >= confirmed;
}
