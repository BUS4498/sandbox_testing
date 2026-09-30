import { env } from "cloudflare:workers";

const MAX_BYTES = 5 * 1024 * 1024;
const TYPES: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  txt: "text/plain",
  md: "text/markdown",
};

async function objectKey(ownerId: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(ownerId));
  const hash = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `private-resumes/${hash}/original`;
}

function bucket(): R2Bucket {
  if (!env.BUCKET) throw new Error("Private resume storage is unavailable.");
  return env.BUCKET;
}

export async function resumeStatus(ownerId: string): Promise<{ stored: boolean; fileName: string; format: string }> {
  if (!env.BUCKET) return { stored: false, fileName: "", format: "" };
  const object = await bucket().head(await objectKey(ownerId));
  return { stored: Boolean(object), fileName: object?.customMetadata?.fileName ?? "", format: object?.customMetadata?.format ?? "" };
}

export async function readOriginalResume(ownerId: string): Promise<{ bytes: ArrayBuffer; fileName: string; contentType: string } | null> {
  if (!env.BUCKET) return null;
  const object = await bucket().get(await objectKey(ownerId));
  if (!object) return null;
  const fileName = object.customMetadata?.fileName ?? "original-resume";
  const format = object.customMetadata?.format ?? "";
  const bytes = await object.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const hash = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  if (hash !== object.customMetadata?.contentHash) throw new Error("The original resume failed private read-back verification.");
  return { bytes, fileName, contentType: TYPES[format] ?? "application/octet-stream" };
}

export async function saveOriginalResume(ownerId: string, file: File): Promise<{ stored: boolean; fileName: string; format: string }> {
  const fileName = file.name.replace(/[\\/\x00-\x1f]/g, "").slice(0, 120);
  const format = fileName.split(".").pop()?.toLowerCase() ?? "";
  if (!TYPES[format] || !file.size || file.size > MAX_BYTES) throw new TypeError("Choose a .docx, .pdf, .md, or .txt resume no larger than 5 MB.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (format === "pdf" && new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-") throw new TypeError("The selected PDF is not valid.");
  if (format === "docx" && !(bytes[0] === 0x50 && bytes[1] === 0x4b)) throw new TypeError("The selected Word file is not valid.");
  const key = await objectKey(ownerId);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const contentHash = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  await bucket().put(key, bytes, { httpMetadata: { contentType: TYPES[format] }, customMetadata: { fileName, format, contentHash } });
  const saved = await bucket().head(key);
  if (!saved || saved.customMetadata?.contentHash !== contentHash || saved.size !== bytes.length) throw new Error("The private original resume failed read-back verification.");
  return { stored: true, fileName, format };
}

export async function deleteOriginalResume(ownerId: string): Promise<void> {
  if (!env.BUCKET) return;
  const key = await objectKey(ownerId);
  await bucket().delete(key);
  if (await bucket().head(key)) throw new Error("The original resume deletion could not be verified.");
}
