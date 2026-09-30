// These are start limits, not provider-billing guarantees. Keep the ledger
// outside resettable collection tables so Reset cannot restore an allowance.
export const USAGE_WINDOW_MS = 24 * 60 * 60 * 1000;
export const RUN_USAGE_LIMITS = Object.freeze({
  COLLECTION: { perStudent: 3, group: "COLLECTION", siteWide: 60 },
  TARGETED_UPDATE: { perStudent: 10, group: "SECONDARY", siteWide: 100 },
  MATERIAL_PREP: { perStudent: 5, group: "SECONDARY", siteWide: 100 },
  INTERVIEW_PRACTICE: { perStudent: 2, group: "SECONDARY", siteWide: 100 },
  FIT_BACKFILL: { perStudent: 2, group: "SECONDARY", siteWide: 100 },
});

// One SQLite statement makes the two count checks and the reservation atomic.
export const INSERT_USAGE_ADMISSION_SQL = "INSERT INTO usage_admissions (id,owner_id,kind,usage_group,started_at) SELECT ?,?,?,?,? WHERE (SELECT COUNT(*) FROM usage_admissions WHERE owner_id=? AND kind=? AND started_at>=?)<? AND (SELECT COUNT(*) FROM usage_admissions WHERE usage_group=? AND started_at>=?)<?";

export function usageWindowStart(now) { return new Date(now.getTime() - USAGE_WINDOW_MS).toISOString(); }
export function retryAfter(oldest) {
  if (!oldest) return null;
  const time = Date.parse(oldest);
  return Number.isFinite(time) ? new Date(time + USAGE_WINDOW_MS).toISOString() : null;
}
