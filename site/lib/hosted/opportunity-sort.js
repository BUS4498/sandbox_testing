/** @typedef {import("./store").OpportunityRecord} OpportunityRecord */
import { assessmentMatchesSetup } from "./opportunity-state.js";

/** Return only a valid score for the student's current assessment profile. */
/** @param {OpportunityRecord} record @param {string | undefined} activeMode @param {string | null | undefined} confirmedAt */
export function currentPreliminaryScore(record, activeMode, confirmedAt = null) {
  const score = record.fitScore;
  return assessmentMatchesSetup(record, { mode: activeMode, confirmedAt }) && score?.status === "SCORED"
    && typeof score.value === "number" && Number.isFinite(score.value)
    && score.value >= 0 && score.value <= 100 ? score.value : null;
}

/** @param {OpportunityRecord} record */
function reviewedAt(record) {
  const time = Date.parse(record.lastAgentReview || record.lastUpdated || "");
  return Number.isFinite(time) ? time : 0;
}

/** @param {OpportunityRecord} left @param {OpportunityRecord} right */
function stableNameOrder(left, right) {
  return left.company.localeCompare(right.company)
    || left.roleTitle.localeCompare(right.roleTitle)
    || left.opportunityId.localeCompare(right.opportunityId);
}

/** Sort a display copy; the saved collection and agent decision remain unchanged. */
/** @param {OpportunityRecord[]} records @param {string | undefined} activeMode @param {"score" | "recent"} [mode] @param {string | null | undefined} confirmedAt */
export function sortOpportunities(records, activeMode, mode = "score", confirmedAt = null) {
  return [...records].sort((left, right) => {
    if (mode === "recent") return reviewedAt(right) - reviewedAt(left) || stableNameOrder(left, right);
    const leftScore = currentPreliminaryScore(left, activeMode, confirmedAt);
    const rightScore = currentPreliminaryScore(right, activeMode, confirmedAt);
    if (leftScore !== null && rightScore !== null) return rightScore - leftScore || stableNameOrder(left, right);
    if (leftScore !== null) return -1;
    if (rightScore !== null) return 1;
    return reviewedAt(right) - reviewedAt(left) || stableNameOrder(left, right);
  });
}
