// These are start limits, not provider-billing guarantees. Keep the ledger
// outside resettable collection tables so Reset cannot restore an allowance.
export const USAGE_WINDOW_MS = 24 * 60 * 60 * 1000;
export const RUN_USAGE_LIMITS = Object.freeze({
  COLLECTION: { perStudent: 5, group: "COLLECTION", siteWide: 60 },
  TARGETED_UPDATE: { perStudent: 10, group: "SECONDARY", siteWide: 100 },
  MATERIAL_PREP: { perStudent: 5, group: "SECONDARY", siteWide: 100 },
  INTERVIEW_PRACTICE: { perStudent: 2, group: "SECONDARY", siteWide: 100 },
  FIT_BACKFILL: { perStudent: 2, group: "SECONDARY", siteWide: 100 },
  ROLE_SUGGESTIONS: { perStudent: 5, group: "SECONDARY", siteWide: 100 },
});

// A one-time, server-verified owner claim controls the exemption. Owner starts
// are audited separately and never consume the shared student pool.
export const OWNER_COLLECTION_USAGE_GROUP = "OWNER_COLLECTION";
export const INSERT_OWNER_COLLECTION_ADMISSION_SQL = "INSERT INTO usage_admissions (id,owner_id,kind,usage_group,started_at) VALUES (?,?,?,?,?)";

export function ownerCollectAllowance() {
  return { allowed: true, ownerUnlimited: true, retryAt: null, reason: "", remainingStudent: null, remainingSite: null, perStudentLimit: null };
}

// One SQLite statement makes the two count checks and the reservation atomic.
export const INSERT_USAGE_ADMISSION_SQL = "INSERT INTO usage_admissions (id,owner_id,kind,usage_group,started_at) SELECT ?,?,?,?,? WHERE (SELECT COUNT(*) FROM usage_admissions WHERE owner_id=? AND kind=? AND started_at>=?)<? AND (SELECT COUNT(*) FROM usage_admissions WHERE usage_group=? AND started_at>=?)<?";

export function usageWindowStart(now) { return new Date(now.getTime() - USAGE_WINDOW_MS).toISOString(); }
export function retryAfter(oldest) {
  if (!oldest) return null;
  const time = Date.parse(oldest);
  return Number.isFinite(time) ? new Date(time + USAGE_WINDOW_MS).toISOString() : null;
}

export function collectAllowanceSnapshot(counts) {
  const { perStudent, siteWide } = RUN_USAGE_LIMITS.COLLECTION;
  const remainingStudent = Math.max(0, perStudent - counts.student.count);
  const remainingSite = Math.max(0, siteWide - counts.site.count);
  const base = { remainingStudent, remainingSite, perStudentLimit: perStudent, ownerUnlimited: false };
  if (remainingStudent === 0) return { ...base, allowed: false, retryAt: retryAfter(counts.student.oldest), reason: `You have used all ${perStudent} Collect starts in the past 24 hours.` };
  if (remainingSite === 0) return { ...base, allowed: false, retryAt: retryAfter(counts.site.oldest), reason: `The Site's ${siteWide} Collect-run slots are full for this 24-hour window.` };
  return { ...base, allowed: true, retryAt: null, reason: "" };
}
