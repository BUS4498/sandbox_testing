import { env } from "cloudflare:workers";
import { appendEvent, getOpportunity, saveOpportunity, type FitScore, type OpportunityRecord, type StudentSetup } from "./store";
import { isApprovedPostingUrl, isMultiOpportunityIndexUrl } from "./source-links.js";
import { compactFitEvidence, JEV_MODEL, normalizeJevAnswer, RUBRIC_VERSION, scoreQuestions } from "./jev-rubric.js";
import { assessmentMatchesSetup } from "./opportunity-state.js";
import { selectJevModel } from "./jev-model-access.js";

export function hasJevKey(): boolean { return Boolean(env.JEV_API_KEY?.trim()); }

export async function availableJevModel(): Promise<string> {
  const key = env.JEV_API_KEY?.trim();
  if (!key) throw new Error("JEV_KEY_NOT_CONFIGURED");
  const response = await fetch("https://api.typesafe.ai/v1/models", {
    headers: { Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`JEV_MODEL_LIST_${response.status}`);
  const model = selectJevModel(await response.json(), JEV_MODEL);
  if (!model) throw new Error("JEV_MODEL_NOT_AVAILABLE");
  return model;
}

async function fingerprint(projection: unknown): Promise<string> {
  const input = new TextEncoder().encode(JSON.stringify({ rubric: RUBRIC_VERSION, evidence: projection }));
  const digest = await crypto.subtle.digest("SHA-256", input);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function scoreState(status: FitScore["status"], reason: string, hash: string): FitScore {
  return { status, value: null, reason, model: JEV_MODEL, rubricVersion: RUBRIC_VERSION, evidenceFingerprint: hash, scoredAt: null, components: null };
}

async function writeScore(ownerId: string, record: OpportunityRecord, score: FitScore): Promise<OpportunityRecord> {
  const next = { ...record, recordVersion: record.recordVersion + 1, fitScore: score };
  return saveOpportunity(ownerId, next, record.recordVersion);
}

export async function scoreSavedOpportunity(ownerId: string, opportunityId: string, setup: StudentSetup, runId: string): Promise<{ status: FitScore["status"] | "SKIPPED"; called: boolean; reason: string }> {
  const record = await getOpportunity(ownerId, opportunityId);
  if (!record) return { status: "SKIPPED", called: false, reason: "Opportunity no longer exists." };
  if (!assessmentMatchesSetup(record, setup)) return { status: "SKIPPED", called: false, reason: "Reassess this opportunity against the current confirmed student setup before scoring." };
  if (isMultiOpportunityIndexUrl(record.postingUrl)) return { status: "SKIPPED", called: false, reason: "Individual posting is not verified." };
  if (record.postingStatus === "UNCERTAIN" && !isApprovedPostingUrl(record.postingUrl)) return { status: "SKIPPED", called: false, reason: "The uncertain listing needs an approved role-specific source before scoring." };
  if (record.postingStatus === "CLOSED") return { status: "SKIPPED", called: false, reason: "The posting is closed and is not scored as a current opportunity." };
  const projection = compactFitEvidence(record, setup);
  if (!projection) return { status: "SKIPPED", called: false, reason: "Current verified qualification and posting evidence is too thin for a defensible preliminary score." };
  // Profile mode and the complete structured evidence are fingerprinted locally;
  // only the compact projection is sent to TypeSafe.
  const hash = await fingerprint({ projection, profileMode: setup.mode, fitAssessment: record.fitAssessment, fitEvidence: record.fitEvidence });
  if (record.fitScore?.evidenceFingerprint === hash && record.fitScore.status === "STALE" && typeof record.fitScore.value === "number") {
    await writeScore(ownerId, record, { ...record.fitScore, status: "SCORED", reason: "Existing score remains current; the scored evidence did not change." });
    return { status: "SCORED", called: false, reason: "Existing score reused without a provider call." };
  }
  if (record.fitScore?.evidenceFingerprint === hash && ["PENDING", "SCORED"].includes(record.fitScore.status)) {
    return { status: "SKIPPED", called: false, reason: "This evidence version was already scored or attempted." };
  }
  if (!hasJevKey()) return { status: "SKIPPED", called: false, reason: "TypeSafe key is not configured." };
  const pending = await writeScore(ownerId, record, scoreState("PENDING", "A preliminary score is being requested.", hash));
  try {
    await appendEvent(ownerId, runId, opportunityId, "ACTION", { action: "JEV_SCORE_ATTEMPT", evidenceFingerprint: hash, model: JEV_MODEL, rubricVersion: RUBRIC_VERSION });
  } catch {
    await writeScore(ownerId, pending, scoreState("FAILED", "The scoring attempt could not be recorded; no TypeSafe request was made.", hash));
    return { status: "FAILED", called: false, reason: "The scoring attempt could not be recorded." };
  }
  let result: FitScore;
  try {
    const selectedModel = await availableJevModel();
    const response = await fetch("https://api.typesafe.ai/v1/systemone", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.JEV_API_KEY!.trim()}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: selectedModel, state: projection, questions: scoreQuestions() }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error(`PROVIDER_${response.status}`);
    const payload = await response.json() as { model?: string; answers?: unknown };
    if (typeof payload?.model !== "string" || !/^jev-(?:latest|\d+(?:\.\d+){1,2})$/i.test(payload.model)) throw new Error("MODEL_MISMATCH");
    const normalized = normalizeJevAnswer(payload);
    result = { status: "SCORED", value: normalized.value, reason: "Based on structured qualification, career, and practical evidence; not a hiring probability.", model: payload.model, rubricVersion: RUBRIC_VERSION, evidenceFingerprint: hash, scoredAt: new Date().toISOString(), components: normalized.components };
  } catch (error) {
    const code = error instanceof Error && /^(?:PROVIDER_\d+|JEV_MODEL_LIST_\d+|JEV_MODEL_NOT_AVAILABLE|JEV_KEY_NOT_CONFIGURED|MODEL_MISMATCH)$/.test(error.message) ? error.message : "REQUEST_OR_RESPONSE_FAILURE";
    result = scoreState("FAILED", `TypeSafe scoring was unavailable (${code}). The evidence-based assessment remains available.`, hash);
  }
  const current = await getOpportunity(ownerId, opportunityId);
  if (!current || current.fitScore?.status !== "PENDING" || current.fitScore.evidenceFingerprint !== hash || current.recordVersion !== pending.recordVersion) {
    await appendEvent(ownerId, runId, opportunityId, "EVALUATION", { expected: "Score saved on unchanged opportunity", observed: "Record changed during scoring", outcome: "FAILURE" });
    return { status: "FAILED", called: true, reason: "Opportunity changed during scoring; result was not applied." };
  }
  const saved = await writeScore(ownerId, current, result);
  await appendEvent(ownerId, runId, opportunityId, "EVALUATION", { expected: "Validated preliminary score and read-back", observed: saved.fitScore?.status, outcome: result.status === "SCORED" ? "SUCCESS" : "PARTIAL SUCCESS", evidenceFingerprint: hash, roundedScore: result.value });
  return { status: result.status, called: true, reason: result.reason };
}
