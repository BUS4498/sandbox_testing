import { env } from "cloudflare:workers";
import { ROLE_SUGGESTION_VERSION, roleProfileFingerprint } from "./role-suggestion-rules.js";
import { OPENAI_MODEL } from "./openai-model";

export type RoleSuggestion = { title: string; reason: string; evidence: { id: string; text: string }[] };
export type RoleSuggestionResult = { suggestions: RoleSuggestion[]; profileFingerprint: string; createdAt: string; model: string; version: string; cached: boolean };

async function cacheKey(ownerId: string) { return `role-suggestions/${await roleProfileFingerprint(ownerId)}/latest.json`; }
function bucket(): R2Bucket { if (!env.BUCKET) throw new Error("Private role-suggestion storage is unavailable."); return env.BUCKET; }
export function roleSuggestionStorageReady() { return Boolean(env.BUCKET && env.DB); }

export async function readRoleSuggestionCache(ownerId: string, fingerprint: string): Promise<RoleSuggestionResult | null> {
  const saved = await bucket().get(await cacheKey(ownerId));
  if (!saved) return null;
  const result = await saved.json<RoleSuggestionResult>();
  if (result.profileFingerprint !== fingerprint || result.version !== ROLE_SUGGESTION_VERSION || result.model !== OPENAI_MODEL) return null;
  return { ...result, cached: true };
}

export async function saveRoleSuggestionCache(ownerId: string, result: RoleSuggestionResult) {
  await bucket().put(await cacheKey(ownerId), JSON.stringify(result), { httpMetadata: { contentType: "application/json" } });
  const saved = await readRoleSuggestionCache(ownerId, result.profileFingerprint);
  if (!saved || JSON.stringify(saved.suggestions) !== JSON.stringify(result.suggestions)) throw new Error("The private suggestions could not be verified after saving.");
}

export async function deleteRoleSuggestionCache(ownerId: string) {
  const key = await cacheKey(ownerId);
  await bucket().delete(key);
  if (await bucket().head(key)) throw new Error("The private role-suggestion cache deletion could not be verified.");
}
