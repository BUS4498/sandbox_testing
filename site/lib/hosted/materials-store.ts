import { env } from "cloudflare:workers";
import { buildDraftPlan, buildRoleDraftPlan, createWordDraft, MATERIAL_TYPES, refreshResumeWordLayout, verifyWordDraft, WORD_MIME } from "./word-drafts.js";
import type { DraftedMaterials } from "./material-drafting";
import { getOpportunity, type OpportunityRecord } from "./store";

export type MaterialType = keyof typeof MATERIAL_TYPES | "INTERVIEW_PRACTICE";
export type MaterialRecord = {
  materialId: string; opportunityId: string; type: MaterialType; title: string;
  fileName: string; createdAt: string; status: "DRAFT_REVIEW_REQUIRED";
  placeholders: string[]; opportunityVersion: number; profileMode: string;
  tailoringChanges?: { original: string; proposed: string; requirement: string; rationale: string }[];
  preparationNotice?: string;
};

type MaterialRow = {
  id: string; owner_id: string; opportunity_id: string; request_id: string; type: string;
  title: string; file_name: string; object_key: string; content_hash: string;
  placeholders_json: string; opportunity_version: number; profile_mode: string;
  created_at: string; status: string;
};

function database(): D1Database {
  if (!env.DB) throw new Error("Private material records are unavailable.");
  return env.DB;
}

function bucket(): R2Bucket {
  if (!env.BUCKET) throw new Error("Private Word draft storage is unavailable.");
  return env.BUCKET;
}

function publicRecord(row: MaterialRow): MaterialRecord {
  const review = JSON.parse(row.placeholders_json);
  return {
    materialId: row.id, opportunityId: row.opportunity_id, type: row.type as MaterialType,
    title: row.title, fileName: row.file_name, createdAt: row.created_at,
    status: "DRAFT_REVIEW_REQUIRED", placeholders: Array.isArray(review) ? review : review.placeholders ?? [],
    tailoringChanges: Array.isArray(review) ? [] : review.tailoringChanges ?? [],
    preparationNotice: Array.isArray(review) ? "" : review.preparationNotice ?? "",
    opportunityVersion: row.opportunity_version, profileMode: row.profile_mode,
  };
}

async function hexSha256(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

export function materialStorageReady(): boolean { return Boolean(env.BUCKET && env.DB); }

export function validateMaterialTypes(value: unknown): MaterialType[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 3) throw new TypeError("Choose one to three Word draft types.");
  const currentTypes = new Set(["TAILORED_RESUME", "COVER_LETTER_DRAFT", "APPLICATION_QUESTION_WORKSHEET"]);
  const types = value.filter((type): type is MaterialType => typeof type === "string" && currentTypes.has(type));
  if (types.length !== value.length || new Set(types).size !== types.length) throw new TypeError("Choose each supported Word draft type at most once.");
  return types;
}

export async function listMaterials(ownerId: string): Promise<MaterialRecord[]> {
  const rows = await database().prepare("SELECT * FROM application_materials WHERE owner_id=? ORDER BY created_at DESC LIMIT 150")
    .bind(ownerId).all<MaterialRow>();
  return rows.results.map(publicRecord);
}

async function getRow(ownerId: string, materialId: string): Promise<MaterialRow | null> {
  return database().prepare("SELECT * FROM application_materials WHERE owner_id=? AND id=? LIMIT 1")
    .bind(ownerId, materialId).first<MaterialRow>();
}

async function priorRequest(ownerId: string, requestId: string, type: MaterialType): Promise<MaterialRow | null> {
  return database().prepare("SELECT * FROM application_materials WHERE owner_id=? AND request_id=? AND type=? LIMIT 1")
    .bind(ownerId, requestId, type).first<MaterialRow>();
}

export async function saveWordMaterial(ownerId: string, record: OpportunityRecord, type: MaterialType, requestId: string, drafted?: DraftedMaterials): Promise<MaterialRecord> {
  if (type === "INTERVIEW_PRACTICE") throw new TypeError("Use the separate Practice Interview action for interview questions.");
  const plan = type === "TAILORED_RESUME" || type === "COVER_LETTER_DRAFT"
    ? buildRoleDraftPlan(record, type, drafted ?? { resumeItems: [], resumeEdits: [], letterParagraphs: [], evidence: [], resumeBaseline: [] })
    : buildDraftPlan(record, type);
  return savePlannedWordMaterial(ownerId, record, type, requestId, plan);
}

export async function saveInterviewWordMaterial(ownerId: string, record: OpportunityRecord, requestId: string, plan: ReturnType<typeof buildDraftPlan>): Promise<MaterialRecord> {
  return savePlannedWordMaterial(ownerId, record, "INTERVIEW_PRACTICE", requestId, plan);
}

async function savePlannedWordMaterial(ownerId: string, record: OpportunityRecord, type: MaterialType, requestId: string, plan: ReturnType<typeof buildDraftPlan>): Promise<MaterialRecord> {
  const prior = await priorRequest(ownerId, requestId, type);
  if (prior) {
    if (prior.opportunity_id !== record.opportunityId) throw new TypeError("This preparation request belongs to another opportunity.");
    if (!await readWordMaterial(ownerId, prior.id)) throw new Error("The previously requested Word draft is no longer available for this opportunity.");
    return publicRecord(prior);
  }
  const now = new Date().toISOString();
  const bytes = createWordDraft(plan, now);
  if (!verifyWordDraft(bytes, plan.title) || bytes.length > 1_000_000) throw new Error("The Word draft could not be verified before saving.");
  const contentHash = await hexSha256(bytes);
  const materialId = crypto.randomUUID();
  const ownerHash = await hexSha256(new TextEncoder().encode(ownerId));
  const opportunityHash = await hexSha256(new TextEncoder().encode(record.opportunityId));
  const objectKey = `materials/${ownerHash}/${opportunityHash}/${materialId}.docx`;
  const fileName = `${type.toLowerCase().replaceAll("_", "-")}-${materialId.slice(0, 8)}.docx`;
  const stored = await bucket().put(objectKey, bytes, { httpMetadata: { contentType: WORD_MIME } });
  if (!stored) throw new Error("The private Word draft could not be saved.");
  let metadataInserted = false;
  try {
    const check = await bucket().get(objectKey);
    if (!check || await hexSha256(new Uint8Array(await check.arrayBuffer())) !== contentHash) throw new Error("The private Word draft failed read-back verification.");
    const result = await database().prepare("INSERT OR IGNORE INTO application_materials (id,owner_id,opportunity_id,request_id,type,title,file_name,object_key,content_hash,placeholders_json,opportunity_version,profile_mode,created_at,status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
      .bind(materialId, ownerId, record.opportunityId, requestId, type, plan.title, fileName, objectKey, contentHash, JSON.stringify({ placeholders: plan.placeholders,
        tailoringChanges: "tailoringChanges" in plan ? plan.tailoringChanges : [],
        preparationNotice: "preparationNotice" in plan ? plan.preparationNotice : "" }), record.recordVersion, record.assessmentProfileMode ?? "SYNTHETIC_DEMONSTRATION", now, "DRAFT_REVIEW_REQUIRED").run();
    if (result.meta?.changes !== 1) {
      const existing = await priorRequest(ownerId, requestId, type);
      if (existing?.opportunity_id === record.opportunityId) {
        await bucket().delete(objectKey);
        return publicRecord(existing);
      }
      throw new Error("The Word draft metadata could not be saved.");
    }
    metadataInserted = true;
    const verified = await getRow(ownerId, materialId);
    if (!verified || verified.content_hash !== contentHash || verified.opportunity_id !== record.opportunityId) throw new Error("The Word draft metadata failed read-back verification.");
    return publicRecord(verified);
  } catch (error) {
    // Never leave a visible metadata row pointing to a file that failed verification.
    if (metadataInserted) await database().prepare("DELETE FROM application_materials WHERE owner_id=? AND id=?")
      .bind(ownerId, materialId).run().catch(() => undefined);
    await bucket().delete(objectKey).catch(() => undefined);
    throw error;
  }
}

export async function readWordMaterial(ownerId: string, materialId: string): Promise<{ metadata: MaterialRecord; bytes: Uint8Array } | null> {
  const row = await getRow(ownerId, materialId);
  if (!row || !await getOpportunity(ownerId, row.opportunity_id)) return null;
  const object = await bucket().get(row.object_key);
  if (!object) throw new Error("The saved Word draft is temporarily unavailable.");
  const bytes = new Uint8Array(await object.arrayBuffer());
  if (await hexSha256(bytes) !== row.content_hash || !verifyWordDraft(bytes, row.title)) throw new Error("The saved Word draft did not pass read-back verification.");
  // Verify the immutable stored file first, then refresh presentation only.
  // Existing drafts benefit without re-generating claims or spending tokens.
  const downloadBytes = row.type === "TAILORED_RESUME" ? refreshResumeWordLayout(bytes) : bytes;
  if (!verifyWordDraft(downloadBytes, row.title)) throw new Error("The refreshed Word layout could not be verified.");
  return { metadata: publicRecord(row), bytes: downloadBytes };
}
