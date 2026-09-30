import { env } from "cloudflare:workers";
import { normalizeRealSetup } from "./profile-rules.js";
import { normalizeStudentResponse } from "./student-response-rules.js";
import { deleteOriginalResume } from "./resume-storage";
import { collectAllowanceSnapshot, INSERT_OWNER_COLLECTION_ADMISSION_SQL, INSERT_USAGE_ADMISSION_SQL, OWNER_COLLECTION_USAGE_GROUP, ownerCollectAllowance, RUN_USAGE_LIMITS, retryAfter, usageWindowStart } from "./usage-policy.js";
import { CLAIM_OWNER_SLOT_SQL, isPairedOwner, OWNER_PAIRING_MAX_ATTEMPTS, ownerPairingWindowStart, pairingCodesMatch, RESERVE_OWNER_PAIRING_ATTEMPT_SQL, validOwnerPairingCode } from "./owner-verification-policy.js";

export type FitScore = {
  status: "PENDING" | "SCORED" | "UNAVAILABLE" | "STALE" | "FAILED";
  value: number | null;
  reason: string;
  model: string;
  rubricVersion: string;
  evidenceFingerprint: string;
  scoredAt: string | null;
  components: Record<string, number> | null;
};

export type OpportunityRecord = {
  opportunityId: string;
  recordVersion: number;
  dateAdded: string;
  dateDiscovered: string;
  lastUpdated: string;
  lastVerified: string;
  lastAgentReview: string;
  company: string;
  roleTitle: string;
  location: string;
  workArrangement: string;
  internshipPeriod: string;
  deadline: string;
  source: string;
  postingUrl: string;
  applicationUrl: string;
  employerPostingId: string;
  postingStatus: "ACTIVE" | "CLOSED" | "UNCERTAIN";
  responsibilities?: string[];
  requiredQualifications?: string[];
  preferredQualifications?: string[];
  fitAssessment: string;
  fitScore?: FitScore;
  fitEvidence: { requiredMatches: string[]; preferredMatches: string[]; gaps: string[]; unknowns: string[]; preferenceAlignment: string[] };
  agentDecision: string;
  decisionRationale: string;
  selectionEvidence: string[];
  nextAction: string;
  nextActionRequest: { prompt: string; responseType: string; options: string[]; whatHappensNext: string };
  nextActionDate: string;
  unresolvedIssue: string;
  attentionRequired: boolean;
  applicationStatus: string;
  studentNotes: string;
  assessmentProfileMode?: "REAL" | "SYNTHETIC_DEMONSTRATION";
  assessmentProfileConfirmedAt?: string | null;
  lastProcessedResponseId?: string;
};

export type StudentResponse = {
  id: string; opportunityId: string; opportunityVersion: number;
  responseType: "INFORMATION" | "CONFIRMATION" | "UNKNOWN" | "NOT_INTERESTED";
  responseText: string; status: "PENDING" | "COMPLETE";
  createdAt: string; processedAt: string | null; errorCode: string | null;
};

export type StudentSetup = {
  mode: "UNSELECTED" | "REAL" | "SYNTHETIC_DEMONSTRATION";
  ready: boolean;
  profileText: string;
  preferences: Record<string, unknown> | null;
  confirmedAt: string | null;
  updatedAt: string | null;
};

export type RunRecord = {
  id: string;
  kind: "COLLECTION" | "TARGETED_UPDATE" | "FIT_BACKFILL" | "MATERIAL_PREP" | "INTERVIEW_PRACTICE";
  status: string;
  stage: string;
  detail: string;
  progress: number;
  startedAt: string;
  finishedAt: string | null;
  summary: Record<string, unknown> | null;
  errorCode: string | null;
};

function database(): D1Database {
  if (!env.DB) throw new Error("Private collection storage is unavailable.");
  return env.DB;
}

async function isOwnerCollectionAccount(authenticatedUserId: string): Promise<boolean> {
  // A missing migration fails closed to ordinary student limits.
  try {
    const row = await database().prepare("SELECT user_id FROM site_owner_identity WHERE slot='owner' LIMIT 1").first<{ user_id: string }>();
    return isPairedOwner(authenticatedUserId, row?.user_id);
  } catch { return false; }
}

export class OwnerVerificationError extends Error {
  constructor(readonly code: "NOT_CONFIGURED" | "WRONG_CODE" | "LIMIT" | "ALREADY_CLAIMED", readonly retryAt: string | null = null) {
    super(code); this.name = "OwnerVerificationError";
  }
}

function configuredOwnerPairingCode(): string | null {
  const value = (env as unknown as { SITE_OWNER_PAIRING_CODE?: string }).SITE_OWNER_PAIRING_CODE;
  return typeof value === "string" && validOwnerPairingCode(value) ? value : null;
}

export async function ownerVerificationStatus(authenticatedUserId: string): Promise<{ verified: boolean; pairingReady: boolean }> {
  return { verified: await isOwnerCollectionAccount(authenticatedUserId), pairingReady: configuredOwnerPairingCode() !== null };
}

export async function claimSiteOwner(authenticatedUserId: string, candidateCode: string): Promise<void> {
  const existing = await database().prepare("SELECT user_id FROM site_owner_identity WHERE slot='owner' LIMIT 1").first<{ user_id: string }>();
  if (isPairedOwner(authenticatedUserId, existing?.user_id)) return;
  if (existing) throw new OwnerVerificationError("ALREADY_CLAIMED");
  const configuredCode = configuredOwnerPairingCode();
  if (!configuredCode) throw new OwnerVerificationError("NOT_CONFIGURED");

  const now = new Date();
  const startedAt = now.toISOString();
  const since = ownerPairingWindowStart(now);
  const reservation = await database().prepare(RESERVE_OWNER_PAIRING_ATTEMPT_SQL)
    .bind(authenticatedUserId, startedAt, since, since, startedAt, since, OWNER_PAIRING_MAX_ATTEMPTS).run();
  if (!reservation.meta?.changes) {
    const row = await database().prepare("SELECT window_started_at FROM owner_pairing_attempts WHERE user_id=?")
      .bind(authenticatedUserId).first<{ window_started_at: string }>();
    throw new OwnerVerificationError("LIMIT", row ? new Date(Date.parse(row.window_started_at) + 24 * 60 * 60 * 1000).toISOString() : null);
  }
  if (!await pairingCodesMatch(candidateCode, configuredCode)) throw new OwnerVerificationError("WRONG_CODE");

  await database().prepare(CLAIM_OWNER_SLOT_SQL).bind(authenticatedUserId, startedAt).run();
  const bound = await database().prepare("SELECT user_id FROM site_owner_identity WHERE slot='owner' LIMIT 1").first<{ user_id: string }>();
  if (!isPairedOwner(authenticatedUserId, bound?.user_id)) throw new OwnerVerificationError("ALREADY_CLAIMED");
}

export class UsageLimitError extends Error {
  readonly retryAt: string | null;
  constructor(message: string, retryAt: string | null) {
    super(message);
    this.name = "UsageLimitError";
    this.retryAt = retryAt;
  }
}

type UsageCount = { count: number; oldest: string | null };
async function usageCounts(ownerId: string, kind: RunRecord["kind"], now: Date): Promise<{ student: UsageCount; site: UsageCount }> {
  const policy = RUN_USAGE_LIMITS[kind];
  const since = usageWindowStart(now);
  const [student, site] = await Promise.all([
    database().prepare("SELECT COUNT(*) AS count, MIN(started_at) AS oldest FROM usage_admissions WHERE owner_id=? AND kind=? AND started_at>=?")
      .bind(ownerId, kind, since).first<UsageCount>(),
    database().prepare("SELECT COUNT(*) AS count, MIN(started_at) AS oldest FROM usage_admissions WHERE usage_group=? AND started_at>=?")
      .bind(policy.group, since).first<UsageCount>(),
  ]);
  return { student: student ?? { count: 0, oldest: null }, site: site ?? { count: 0, oldest: null } };
}

export async function collectionAllowance(ownerId: string): Promise<{ allowed: boolean; ownerUnlimited: boolean; retryAt: string | null; reason: string; remainingStudent: number | null; remainingSite: number | null; perStudentLimit: number | null }> {
  if (await isOwnerCollectionAccount(ownerId)) return ownerCollectAllowance();
  const counts = await usageCounts(ownerId, "COLLECTION", new Date());
  return collectAllowanceSnapshot(counts);
}

export function canonicalUrl(value: string): string {
  const url = new URL(value);
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("A public posting URL is required.");
  url.hash = "";
  for (const key of [...url.searchParams.keys()]) {
    if (/^(utm_|fbclid$|gclid$|ref$|source$|gh_src$)/i.test(key)) url.searchParams.delete(key);
  }
  url.hostname = url.hostname.toLowerCase();
  url.pathname = url.pathname.replace(/\/+$/, "") || "/";
  return url.toString();
}

function normalize(value: string): string {
  return value.toLowerCase().normalize("NFKC").replace(/[^a-z0-9]+/g, " ").trim();
}

function parseRecord(row: { record_json: string }): OpportunityRecord {
  return JSON.parse(row.record_json) as OpportunityRecord;
}

export async function listOpportunities(ownerId: string): Promise<OpportunityRecord[]> {
  const result = await database().prepare("SELECT record_json FROM opportunities WHERE owner_id = ? ORDER BY updated_at DESC LIMIT 500").bind(ownerId).all<{ record_json: string }>();
  return result.results.map(parseRecord);
}

export async function getOpportunity(ownerId: string, opportunityId: string): Promise<OpportunityRecord | null> {
  const row = await database().prepare("SELECT record_json FROM opportunities WHERE owner_id=? AND id=? LIMIT 1")
    .bind(ownerId, opportunityId).first<{ record_json: string }>();
  return row ? parseRecord(row) : null;
}

function mapStudentResponse(row: Record<string, unknown>): StudentResponse {
  return {
    id: String(row.id), opportunityId: String(row.opportunity_id), opportunityVersion: Number(row.opportunity_version),
    responseType: String(row.response_type) as StudentResponse["responseType"], responseText: String(row.response_text),
    status: String(row.status) as StudentResponse["status"], createdAt: String(row.created_at),
    processedAt: row.processed_at ? String(row.processed_at) : null,
    errorCode: row.error_code ? String(row.error_code) : null,
  };
}

export async function listStudentResponses(ownerId: string): Promise<StudentResponse[]> {
  const result = await database().prepare("SELECT * FROM student_responses WHERE owner_id=? ORDER BY created_at DESC LIMIT 100")
    .bind(ownerId).all<Record<string, unknown>>();
  return result.results.map(mapStudentResponse);
}

export async function getStudentResponse(ownerId: string, responseId: string): Promise<StudentResponse | null> {
  const row = await database().prepare("SELECT * FROM student_responses WHERE owner_id=? AND id=? LIMIT 1")
    .bind(ownerId, responseId).first<Record<string, unknown>>();
  return row ? mapStudentResponse(row) : null;
}

export async function saveStudentResponse(ownerId: string, input: unknown): Promise<StudentResponse> {
  const response = normalizeStudentResponse(input);
  const current = await getOpportunity(ownerId, response.opportunityId);
  if (!current) throw new TypeError("This opportunity is no longer in your collection.");
  if (current.recordVersion !== response.recordVersion) throw new TypeError("This opportunity changed. Refresh it before saving your answer.");
  const pending = await database().prepare("SELECT id FROM student_responses WHERE owner_id=? AND opportunity_id=? AND status='PENDING' LIMIT 1")
    .bind(ownerId, response.opportunityId).first<{ id: string }>();
  if (pending) throw new TypeError("A response is already saved for this opportunity. Retry its update before adding another answer.");
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const note = response.responseText || (response.responseType === "NOT_INTERESTED" ? "Student chose not to pursue this opportunity." : "Student cannot answer the current question yet.");
  const updated: OpportunityRecord = {
    ...current, recordVersion: current.recordVersion + 1, lastUpdated: now,
    studentNotes: [current.studentNotes, `[${now}] ${response.responseType}: ${note}`].filter(Boolean).join("\n"),
  };
  const result = await database().batch([
    database().prepare("INSERT INTO student_responses (id,owner_id,opportunity_id,opportunity_version,response_type,response_text,status,created_at,processed_at,error_code) SELECT ?,?,?,?,?,?,'PENDING',?,NULL,NULL WHERE EXISTS (SELECT id FROM opportunities WHERE owner_id=? AND id=? AND record_version=?) AND NOT EXISTS (SELECT id FROM student_responses WHERE owner_id=? AND opportunity_id=? AND status='PENDING')")
      .bind(id, ownerId, response.opportunityId, current.recordVersion, response.responseType, response.responseText, now, ownerId, response.opportunityId, current.recordVersion, ownerId, response.opportunityId),
    database().prepare("UPDATE opportunities SET record_json=?,record_version=?,updated_at=? WHERE owner_id=? AND id=? AND record_version=? AND EXISTS (SELECT id FROM student_responses WHERE id=? AND owner_id=?)")
      .bind(JSON.stringify(updated), updated.recordVersion, now, ownerId, response.opportunityId, current.recordVersion, id, ownerId),
  ]);
  if (result[0].meta?.changes !== 1 || result[1].meta?.changes !== 1) {
    throw new Error("The opportunity changed before the response could be saved. Refresh and try again.");
  }
  const [savedResponse, savedOpportunity] = await Promise.all([getStudentResponse(ownerId, id), getOpportunity(ownerId, response.opportunityId)]);
  if (!savedResponse || !savedOpportunity || savedOpportunity.recordVersion !== updated.recordVersion || savedOpportunity.studentNotes !== updated.studentNotes) {
    throw new Error("The student response could not be verified after saving.");
  }
  return savedResponse;
}

export async function completeStudentResponse(ownerId: string, responseId: string): Promise<StudentResponse> {
  const now = new Date().toISOString();
  await database().prepare("UPDATE student_responses SET status='COMPLETE',processed_at=?,error_code=NULL WHERE owner_id=? AND id=? AND status='PENDING'")
    .bind(now, ownerId, responseId).run();
  const saved = await getStudentResponse(ownerId, responseId);
  if (!saved || saved.status !== "COMPLETE") throw new Error("The student response completion could not be verified.");
  return saved;
}

export async function markStudentResponsePending(ownerId: string, responseId: string, errorCode: string): Promise<void> {
  await database().prepare("UPDATE student_responses SET error_code=? WHERE owner_id=? AND id=? AND status='PENDING'")
    .bind(errorCode, ownerId, responseId).run();
}

export async function getStudentSetup(ownerId: string): Promise<StudentSetup> {
  const row = await database().prepare("SELECT mode,profile_text,preferences_json,confirmed_at,updated_at FROM student_setups WHERE owner_id=?")
    .bind(ownerId).first<{ mode: string; profile_text: string; preferences_json: string; confirmed_at: string | null; updated_at: string }>();
  if (!row) {
    // This owner explicitly used the synthetic pilot before setup controls
    // existed. Other users must choose a setup mode for themselves.
    const legacy = await database().prepare("SELECT id FROM runs WHERE owner_id=? LIMIT 1").bind(ownerId).first<{ id: string }>();
    return { mode: legacy ? "SYNTHETIC_DEMONSTRATION" : "UNSELECTED", ready: Boolean(legacy), profileText: "", preferences: null, confirmedAt: null, updatedAt: null };
  }
  const mode = row.mode === "REAL" ? "REAL" : row.mode === "SYNTHETIC_DEMONSTRATION" ? "SYNTHETIC_DEMONSTRATION" : "UNSELECTED";
  const preferences = row.preferences_json && row.preferences_json !== "{}" ? JSON.parse(row.preferences_json) as Record<string, unknown> : null;
  return { mode, ready: mode === "SYNTHETIC_DEMONSTRATION" || (mode === "REAL" && Boolean(row.profile_text && preferences && row.confirmed_at)), profileText: row.profile_text, preferences, confirmedAt: row.confirmed_at, updatedAt: row.updated_at };
}

export async function saveRealStudentSetup(ownerId: string, input: unknown): Promise<StudentSetup> {
  const normalized = normalizeRealSetup(input);
  const now = new Date().toISOString();
  const preferenceJson = JSON.stringify(normalized.preferences);
  const existing = await getStudentSetup(ownerId);
  const unchanged = existing.mode === "REAL" && existing.profileText === normalized.profileText
    && JSON.stringify(existing.preferences) === preferenceJson;
  const confirmedAt = unchanged && existing.confirmedAt ? existing.confirmedAt : now;
  await database().prepare("INSERT INTO student_setups (owner_id,mode,profile_text,preferences_json,confirmed_at,updated_at) VALUES (?,?,?,?,?,?) ON CONFLICT(owner_id) DO UPDATE SET mode=excluded.mode,profile_text=excluded.profile_text,preferences_json=excluded.preferences_json,confirmed_at=excluded.confirmed_at,updated_at=excluded.updated_at")
    .bind(ownerId, "REAL", normalized.profileText, preferenceJson, confirmedAt, now).run();
  const saved = await getStudentSetup(ownerId);
  if (saved.mode !== "REAL" || !saved.ready || saved.profileText !== normalized.profileText || JSON.stringify(saved.preferences) !== preferenceJson) {
    throw new Error("The student setup did not pass private read-back verification.");
  }
  return saved;
}

export async function chooseStudentSetupMode(ownerId: string, mode: "REAL" | "SYNTHETIC_DEMONSTRATION"): Promise<StudentSetup> {
  const existing = await getStudentSetup(ownerId);
  if (mode === "REAL" && (!existing.profileText || !existing.preferences || !existing.confirmedAt)) {
    throw new TypeError("Save and confirm a real student setup before selecting it.");
  }
  const now = new Date().toISOString();
  await database().prepare("INSERT INTO student_setups (owner_id,mode,profile_text,preferences_json,confirmed_at,updated_at) VALUES (?,?,?,?,?,?) ON CONFLICT(owner_id) DO UPDATE SET mode=excluded.mode,updated_at=excluded.updated_at")
    .bind(ownerId, mode, existing.profileText, JSON.stringify(existing.preferences ?? {}), existing.confirmedAt, now).run();
  const saved = await getStudentSetup(ownerId);
  if (saved.mode !== mode || !saved.ready) throw new Error("The selected setup mode did not pass read-back verification.");
  return saved;
}

export async function deletePrivateStudentProfile(ownerId: string): Promise<StudentSetup> {
  await deleteOriginalResume(ownerId);
  const now = new Date().toISOString();
  await database().prepare("INSERT INTO student_setups (owner_id,mode,profile_text,preferences_json,confirmed_at,updated_at) VALUES (?,?,?,?,?,?) ON CONFLICT(owner_id) DO UPDATE SET mode=excluded.mode,profile_text='',preferences_json='{}',confirmed_at=NULL,updated_at=excluded.updated_at")
    .bind(ownerId, "UNSELECTED", "", "{}", null, now).run();
  const saved = await getStudentSetup(ownerId);
  if (saved.mode !== "UNSELECTED" || saved.profileText || saved.preferences) throw new Error("The private profile deletion could not be verified.");
  return saved;
}

export async function findDuplicate(ownerId: string, candidate: { postingUrl: string; employerPostingId: string; company: string; roleTitle: string; location: string; internshipPeriod: string }): Promise<{ classification: "NONE" | "EXACT" | "POSSIBLE"; record: OpportunityRecord | null }> {
  const url = canonicalUrl(candidate.postingUrl);
  const exact = await database().prepare("SELECT record_json FROM opportunities WHERE owner_id = ? AND canonical_url = ? LIMIT 1").bind(ownerId, url).first<{ record_json: string }>();
  if (exact) return { classification: "EXACT", record: parseRecord(exact) };
  const related = await database().prepare("SELECT record_json FROM opportunities WHERE owner_id = ? AND normalized_company = ? AND normalized_role = ? LIMIT 10")
    .bind(ownerId, normalize(candidate.company), normalize(candidate.roleTitle)).all<{ record_json: string }>();
  const strong = related.results.filter((row) => {
    const record = parseRecord(row);
    return candidate.employerPostingId && record.employerPostingId && candidate.employerPostingId === record.employerPostingId;
  });
  if (strong.length === 1) return { classification: "EXACT", record: parseRecord(strong[0]) };
  const possible = related.results.filter((row) => {
    const record = parseRecord(row);
    return normalize(record.internshipPeriod) === normalize(candidate.internshipPeriod) && normalize(record.location) === normalize(candidate.location);
  });
  return possible.length ? { classification: "POSSIBLE", record: parseRecord(possible[0]) } : { classification: "NONE", record: null };
}

export async function saveOpportunity(ownerId: string, record: OpportunityRecord, expectedVersion: number | null): Promise<OpportunityRecord> {
  const now = new Date().toISOString();
  const url = canonicalUrl(record.postingUrl);
  if (expectedVersion === null) {
    const result = await database().prepare("INSERT OR IGNORE INTO opportunities (id,owner_id,canonical_url,employer_posting_id,normalized_company,normalized_role,normalized_location,normalized_period,record_json,record_version,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)")
      .bind(record.opportunityId, ownerId, url, record.employerPostingId, normalize(record.company), normalize(record.roleTitle), normalize(record.location), normalize(record.internshipPeriod), JSON.stringify(record), 1, now, now).run();
    if (!result.meta?.changes) throw new Error("An opportunity with this identity is already recorded.");
  } else {
    const result = await database().prepare("UPDATE opportunities SET canonical_url=?,employer_posting_id=?,normalized_company=?,normalized_role=?,normalized_location=?,normalized_period=?,record_json=?,record_version=?,updated_at=? WHERE owner_id=? AND id=? AND record_version=?")
      .bind(url, record.employerPostingId, normalize(record.company), normalize(record.roleTitle), normalize(record.location), normalize(record.internshipPeriod), JSON.stringify(record), expectedVersion + 1, now, ownerId, record.opportunityId, expectedVersion).run();
    if (!result.meta?.changes) throw new Error("The opportunity changed during this run; review it before retrying.");
  }
  const readBack = await database().prepare("SELECT record_json,record_version FROM opportunities WHERE owner_id=? AND id=? LIMIT 1")
    .bind(ownerId, record.opportunityId).first<{ record_json: string; record_version: number }>();
  if (!readBack || readBack.record_json !== JSON.stringify(record) || readBack.record_version !== record.recordVersion) {
    throw new Error("The saved opportunity did not pass read-back verification.");
  }
  return parseRecord(readBack);
}

export async function appendEvent(ownerId: string, runId: string, opportunityId: string | null, kind: string, payload: Record<string, unknown>): Promise<void> {
  await database().prepare("INSERT INTO operational_events (id,owner_id,run_id,opportunity_id,kind,payload_json,created_at) VALUES (?,?,?,?,?,?,?)")
    .bind(crypto.randomUUID(), ownerId, runId, opportunityId, kind, JSON.stringify(payload), new Date().toISOString()).run();
}

export async function startRun(ownerId: string, kind: RunRecord["kind"] = "COLLECTION"): Promise<RunRecord> {
  const now = new Date();
  const id = crypto.randomUUID();
  const startedAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + (kind === "COLLECTION" ? 20 : 5) * 60_000).toISOString();
  await database().prepare("DELETE FROM run_locks WHERE owner_id=? AND expires_at<?").bind(ownerId, startedAt).run();
  await database().prepare("INSERT OR IGNORE INTO run_locks (owner_id,run_id,expires_at) VALUES (?,?,?)").bind(ownerId, id, expiresAt).run();
  const lock = await database().prepare("SELECT run_id FROM run_locks WHERE owner_id=?").bind(ownerId).first<{ run_id: string }>();
  if (lock?.run_id !== id) throw new Error("A workflow is already in progress.");
  const run: RunRecord = { id, kind, status: "IN_PROGRESS", stage: "RETRIEVE", detail: kind === "TARGETED_UPDATE" ? "Reading this opportunity, the saved student response, and the confirmed profile." : kind === "FIT_BACKFILL" ? "Checking existing opportunities for score-ready evidence; no web search." : kind === "MATERIAL_PREP" ? "Reading the selected opportunity and its verified fit evidence before preparing Word drafts." : kind === "INTERVIEW_PRACTICE" ? "Reading the selected opportunity before an on-demand public interview-question search." : "Reading the selected student setup and current collection.", progress: 5, startedAt, finishedAt: null, summary: null, errorCode: null };
  let admitted = false;
  try {
    if (kind === "COLLECTION" && await isOwnerCollectionAccount(ownerId)) {
      await database().prepare(INSERT_OWNER_COLLECTION_ADMISSION_SQL)
        .bind(id, ownerId, kind, OWNER_COLLECTION_USAGE_GROUP, startedAt).run();
    } else {
      const policy = RUN_USAGE_LIMITS[kind];
      const since = usageWindowStart(now);
      const result = await database().prepare(INSERT_USAGE_ADMISSION_SQL)
        .bind(id, ownerId, kind, policy.group, startedAt, ownerId, kind, since, policy.perStudent, policy.group, since, policy.siteWide).run();
      if (!result.meta?.changes) {
        const counts = await usageCounts(ownerId, kind, now);
        if (counts.student.count >= policy.perStudent) throw new UsageLimitError(kind === "COLLECTION" ? `You have used all ${policy.perStudent} Collect starts in the past 24 hours.` : `You have reached the 24-hour limit for ${kind.replaceAll("_", " ").toLowerCase()}.`, retryAfter(counts.student.oldest));
        throw new UsageLimitError(kind === "COLLECTION" ? `The Site's ${policy.siteWide} Collect-run slots are full for this 24-hour window.` : "The Site's 24-hour capacity for this action is full. Try again later.", retryAfter(counts.site.oldest));
      }
    }
    admitted = true;
    await database().prepare("INSERT INTO runs (id,owner_id,kind,status,stage,detail,progress,started_at,finished_at,summary_json,error_code) VALUES (?,?,?,?,?,?,?,?,?,?,?)")
      .bind(id, ownerId, kind, run.status, run.stage, run.detail, run.progress, startedAt, null, null, null).run();
  } catch (error) {
    if (admitted) await database().prepare("DELETE FROM usage_admissions WHERE id=? AND owner_id=?").bind(id, ownerId).run().catch(() => undefined);
    await database().prepare("DELETE FROM run_locks WHERE owner_id=? AND run_id=?").bind(ownerId, id).run();
    throw error;
  }
  return run;
}

export async function updateRun(ownerId: string, run: RunRecord): Promise<void> {
  await database().prepare("UPDATE runs SET status=?,stage=?,detail=?,progress=?,finished_at=?,summary_json=?,error_code=? WHERE owner_id=? AND id=?")
    .bind(run.status, run.stage, run.detail, run.progress, run.finishedAt, run.summary ? JSON.stringify(run.summary) : null, run.errorCode, ownerId, run.id).run();
}

export async function finishRun(ownerId: string, run: RunRecord): Promise<void> {
  await updateRun(ownerId, run);
  await database().prepare("DELETE FROM run_locks WHERE owner_id=? AND run_id=?").bind(ownerId, run.id).run();
}

function mapRun(row: Record<string, unknown>): RunRecord {
  return { id: String(row.id), kind: row.kind === "TARGETED_UPDATE" ? "TARGETED_UPDATE" : row.kind === "FIT_BACKFILL" ? "FIT_BACKFILL" : row.kind === "MATERIAL_PREP" ? "MATERIAL_PREP" : row.kind === "INTERVIEW_PRACTICE" ? "INTERVIEW_PRACTICE" : "COLLECTION", status: String(row.status), stage: String(row.stage), detail: String(row.detail), progress: Number(row.progress), startedAt: String(row.started_at), finishedAt: row.finished_at ? String(row.finished_at) : null, summary: row.summary_json ? JSON.parse(String(row.summary_json)) as Record<string, unknown> : null, errorCode: row.error_code ? String(row.error_code) : null };
}

export async function latestRun(ownerId: string): Promise<RunRecord | null> {
  const row = await database().prepare("SELECT * FROM runs WHERE owner_id=? ORDER BY started_at DESC LIMIT 1").bind(ownerId).first<Record<string, unknown>>();
  if (!row) return null;
  const run = mapRun(row);
  if (run.status === "IN_PROGRESS") {
    const lock = await database().prepare("SELECT expires_at FROM run_locks WHERE owner_id=? AND run_id=?").bind(ownerId, run.id).first<{ expires_at: string }>();
    if (!lock || lock.expires_at < new Date().toISOString()) {
      run.status = "FAILURE";
      run.stage = "ACTION_REQUIRED";
      run.detail = run.kind === "TARGETED_UPDATE" ? "The prior opportunity update stopped before it finished. Your response is saved and can be retried." : run.kind === "FIT_BACKFILL" ? "The prior fit-scoring pass stopped. Pending score attempts will not be repeated automatically." : run.kind === "MATERIAL_PREP" ? "The prior Word draft preparation stopped. Check saved drafts before trying again." : run.kind === "INTERVIEW_PRACTICE" ? "The prior interview-practice search stopped. No unfinished research is presented as verified." : "The prior collection run stopped before it finished. No incomplete action is presented as successful.";
      run.finishedAt = new Date().toISOString();
      run.errorCode = "RUN_INTERRUPTED";
      await finishRun(ownerId, run);
    }
  }
  return run;
}
