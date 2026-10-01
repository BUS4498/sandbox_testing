import { assertNoDirectIdentifier } from "./profile-rules.js";
import { isResumeSectionHeading, resumeLines } from "./resume-structure.js";

export const ROLE_SUGGESTION_VERSION = "resume-roles-v1";
export const MAX_ROLE_SUGGESTIONS = 8;
export const ROLE_SUGGESTION_SCHEMA = {
  type: "object", additionalProperties: false,
  properties: { suggestions: { type: "array", maxItems: MAX_ROLE_SUGGESTIONS, items: {
    type: "object", additionalProperties: false,
    properties: {
      title: { type: "string", minLength: 5, maxLength: 120 },
      reason: { type: "string", minLength: 12, maxLength: 280 },
      evidenceIds: { type: "array", minItems: 1, maxItems: 3, items: { type: "string" } },
    }, required: ["title", "reason", "evidenceIds"],
  } } }, required: ["suggestions"],
};

export function normalizeSuggestionPreview(input) {
  if (!input || input.confirmedNoIdentifiers !== true || input.roleSuggestionConsent !== true) {
    throw new TypeError("Review the resume preview, remove identifiers, and approve resume-based role suggestions first.");
  }
  if (typeof input.profileText !== "string") throw new TypeError("Upload and review a resume before requesting suggestions.");
  const profile = input.profileText.replace(/\r\n?/g, "\n").trim();
  if (profile.length < 40 || profile.length > 30_000) throw new TypeError("The reviewed resume needs 40–30,000 characters of readable evidence.");
  assertNoDirectIdentifier([profile], "role-suggestion preview");
  return profile;
}

export async function roleProfileFingerprint(profile) {
  const normalized = profile.replace(/\r\n?/g, "\n").trim();
  const bytes = new TextEncoder().encode(normalized);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

export function roleEvidence(profile) {
  const lines = resumeLines(profile).filter(line => line.length >= 10 && !isResumeSectionHeading(line)
    && !/^(?:citizenship|work authorization|sponsorship|availability|address|phone|email)\s*:/i.test(line));
  // Keep early education and later skills, and spread the remainder across the resume.
  const indexes = new Set([...lines.slice(0, 12).map((_, index) => index),
    ...lines.slice(-10).map((_, index) => Math.max(0, lines.length - 10) + index)]);
  for (let index = 0; index < 18 && lines.length; index++) indexes.add(Math.floor(index * (lines.length - 1) / 17));
  let total = 0;
  const selected = [...indexes].sort((a, b) => a - b).flatMap(index => {
    const text = lines[index]?.slice(0, 700);
    if (!text || total + text.length > 8_000) return [];
    total += text.length;
    return [{ id: `R${index + 1}`, text }];
  });
  if (!selected.length) throw new TypeError("The reviewed resume needs readable education, coursework, skills, projects, or experience.");
  return selected;
}

export function validateRoleSuggestions(value, evidence) {
  if (!value || !Array.isArray(value.suggestions) || value.suggestions.length > MAX_ROLE_SUGGESTIONS) {
    throw new TypeError("The role suggestions did not pass the bounded result checks. Try again later.");
  }
  const byId = new Map(evidence.map(item => [item.id, item.text]));
  const titles = new Set();
  return value.suggestions.map(item => {
    if (!item || typeof item.title !== "string" || typeof item.reason !== "string"
      || !Array.isArray(item.evidenceIds) || item.evidenceIds.length < 1 || item.evidenceIds.length > 3) {
      throw new TypeError("A suggestion was missing its role title, explanation, or resume evidence.");
    }
    const title = item.title.trim().replace(/\s+/g, " ");
    const reason = item.reason.trim();
    if (title.length < 5 || title.length > 120 || reason.length < 12 || reason.length > 280
      || !/\bintern(?:ship)?\b/i.test(title) || /\b(?:senior|director|principal|head of|lead)\b/i.test(title)
      || titles.has(title.toLowerCase()) || new Set(item.evidenceIds).size !== item.evidenceIds.length
      || item.evidenceIds.some(id => typeof id !== "string" || !byId.has(id))) {
      throw new TypeError("A suggestion was duplicated, not an internship role, or not supported by the supplied resume references.");
    }
    assertNoDirectIdentifier([title, reason], "role suggestions");
    titles.add(title.toLowerCase());
    return { title, reason, evidence: item.evidenceIds.map(id => ({ id, text: byId.get(id) })) };
  });
}
