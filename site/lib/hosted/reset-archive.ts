import { env } from "cloudflare:workers";
import { strToU8, unzipSync, zipSync } from "fflate";

const TABLES = ["opportunities", "runs", "operational_events", "student_responses", "application_materials"] as const;
const MAX_ARCHIVE_BYTES = 25_000_000;

type TableName = typeof TABLES[number];
type PrivateRow = Record<string, unknown>;
type MaterialRow = PrivateRow & { id: string; object_key: string; content_hash: string };
type ArchiveManifest = {
  formatVersion: 1;
  archiveId: string;
  createdAt: string;
  counts: Record<TableName, number>;
  wordFiles: { materialId: string; objectKey: string; file: string; sha256: string }[];
};

export type ResetArchive = { id: string; createdAt: string; opportunityCount: number; wordFileCount: number; byteSize: number };
export type ResetResult = { archive: ResetArchive; retiredWordFilesPending: number };

function db(): D1Database {
  if (!env.DB) throw new Error("Private collection storage is unavailable.");
  return env.DB;
}
function bucket(): R2Bucket {
  if (!env.BUCKET) throw new Error("Private archive storage is unavailable.");
  return env.BUCKET;
}
export function resetStorageReady(): boolean { return Boolean(env.DB && env.BUCKET); }

async function sha256(bytes: Uint8Array): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
  return [...new Uint8Array(hash)].map((value) => value.toString(16).padStart(2, "0")).join("");
}
async function ownerPrefix(ownerId: string): Promise<string> {
  return `reset-archives/${await sha256(strToU8(ownerId))}/`;
}
async function materialPrefix(ownerId: string): Promise<string> {
  return `materials/${await sha256(strToU8(ownerId))}/`;
}
async function archiveKey(ownerId: string, archiveId: string): Promise<string> {
  if (!/^[0-9a-f-]{36}$/i.test(archiveId)) throw new TypeError("The reset archive was not found.");
  return `${await ownerPrefix(ownerId)}${archiveId}.zip`;
}

async function ownerRows(table: TableName, ownerId: string): Promise<PrivateRow[]> {
  const total = await db().prepare(`SELECT COUNT(*) AS count FROM ${table} WHERE owner_id=?`).bind(ownerId).first<{ count: number }>();
  const rows = await db().prepare(`SELECT * FROM ${table} WHERE owner_id=?`).bind(ownerId).all<PrivateRow>();
  if (rows.results.length !== Number(total?.count ?? 0)) throw new Error("The full active history could not be read for archiving. Nothing was cleared.");
  return rows.results;
}

function parseManifest(entries: Record<string, Uint8Array>): ArchiveManifest {
  if (!entries["manifest.json"]) throw new Error("The recovery archive has no manifest.");
  const manifest = JSON.parse(new TextDecoder().decode(entries["manifest.json"])) as ArchiveManifest;
  if (manifest.formatVersion !== 1 || !Array.isArray(manifest.wordFiles)) throw new Error("The recovery archive format is unsupported.");
  return manifest;
}

function archiveSummary(object: R2Object): ResetArchive {
  const id = object.key.split("/").pop()?.replace(/\.zip$/, "") ?? "";
  const meta = object.customMetadata ?? {};
  return {
    id,
    createdAt: meta.createdAt || object.uploaded.toISOString(),
    opportunityCount: Number(meta.opportunityCount || 0),
    wordFileCount: Number(meta.wordFileCount || 0),
    byteSize: object.size,
  };
}

export async function listResetArchives(ownerId: string): Promise<ResetArchive[]> {
  const listed = await bucket().list({ prefix: await ownerPrefix(ownerId), limit: 1000 });
  if (listed.truncated) throw new Error("There are too many archives to list safely; request support before deleting any.");
  const verifiedObjects = await Promise.all(listed.objects.filter((object) => object.key.endsWith(".zip")).map((object) => bucket().head(object.key)));
  return verifiedObjects.filter((object): object is R2Object => Boolean(object)).map(archiveSummary)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function readResetArchive(ownerId: string, archiveId: string): Promise<{ bytes: Uint8Array; archive: ResetArchive; manifest: ArchiveManifest } | null> {
  const object = await bucket().get(await archiveKey(ownerId, archiveId));
  if (!object) return null;
  const bytes = new Uint8Array(await object.arrayBuffer());
  if (await sha256(bytes) !== object.customMetadata?.sha256) throw new Error("The recovery archive failed checksum verification.");
  const manifest = parseManifest(unzipSync(bytes));
  if (manifest.archiveId !== archiveId) throw new Error("The recovery archive identity could not be verified.");
  return { bytes, archive: archiveSummary(object), manifest };
}

async function lockReset(ownerId: string, resetId: string): Promise<void> {
  const now = new Date();
  await db().prepare("DELETE FROM run_locks WHERE owner_id=? AND expires_at<?").bind(ownerId, now.toISOString()).run();
  await db().prepare("INSERT OR IGNORE INTO run_locks (owner_id,run_id,expires_at) VALUES (?,?,?)")
    .bind(ownerId, resetId, new Date(now.getTime() + 15 * 60_000).toISOString()).run();
  const lock = await db().prepare("SELECT run_id FROM run_locks WHERE owner_id=?").bind(ownerId).first<{ run_id: string }>();
  if (lock?.run_id !== resetId) throw new Error("Another workflow is in progress. Wait for it to finish before resetting.");
}

async function activeCounts(ownerId: string): Promise<Record<TableName, number>> {
  const result = {} as Record<TableName, number>;
  for (const table of TABLES) {
    const row = await db().prepare(`SELECT COUNT(*) AS count FROM ${table} WHERE owner_id=?`).bind(ownerId).first<{ count: number }>();
    result[table] = Number(row?.count ?? 0);
  }
  return result;
}

export async function archiveAndReset(ownerId: string): Promise<ResetResult> {
  if (!resetStorageReady()) throw new Error("Private archive storage is unavailable. Nothing was cleared.");
  const resetId = crypto.randomUUID();
  await lockReset(ownerId, resetId);
  try {
    if ((await listResetArchives(ownerId)).length >= 5) throw new TypeError("You already have five recovery archives. Download and explicitly delete one before resetting again; no current records were cleared.");
    const rows = {} as Record<TableName, PrivateRow[]>;
    for (const table of TABLES) rows[table] = await ownerRows(table, ownerId);
    const counts = Object.fromEntries(TABLES.map((table) => [table, rows[table].length])) as Record<TableName, number>;
    if (Object.values(counts).every((value) => value === 0)) throw new TypeError("The active collection and its history are already empty.");

    const archiveId = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const entries: Record<string, Uint8Array> = {};
    let rawBytes = 0;
    for (const table of TABLES) {
      const content = strToU8(JSON.stringify(rows[table], null, 2));
      entries[`records/${table}.json`] = content;
      rawBytes += content.length;
    }
    const wordFiles: ArchiveManifest["wordFiles"] = [];
    const allowedPrefix = await materialPrefix(ownerId);
    for (const row of rows.application_materials as MaterialRow[]) {
      if (!row.object_key.startsWith(allowedPrefix) || !/^[0-9a-f-]{36}$/i.test(row.id)) {
        throw new Error("A Word draft has an unexpected storage identity. Nothing was cleared.");
      }
      const object = await bucket().get(row.object_key);
      if (!object) throw new Error("A saved Word draft is missing. Nothing was cleared.");
      const bytes = new Uint8Array(await object.arrayBuffer());
      if (await sha256(bytes) !== row.content_hash) throw new Error("A saved Word draft failed verification. Nothing was cleared.");
      const file = `word-drafts/${row.id}.docx`;
      entries[file] = bytes;
      rawBytes += bytes.length;
      if (rawBytes > MAX_ARCHIVE_BYTES) throw new Error("The private history exceeds the safe archive size. Nothing was cleared.");
      wordFiles.push({ materialId: row.id, objectKey: row.object_key, file, sha256: row.content_hash });
    }
    const manifest: ArchiveManifest = { formatVersion: 1, archiveId, createdAt, counts, wordFiles };
    entries["manifest.json"] = strToU8(JSON.stringify(manifest, null, 2));
    entries["README.txt"] = strToU8("Private recovery archive for the Internship Prep Desk. Records are JSON; Word drafts are in word-drafts/. This Site does not offer one-click restore. Keep this file private.\n");
    if (rawBytes + entries["manifest.json"].length > MAX_ARCHIVE_BYTES) throw new Error("The private history exceeds the safe archive size. Nothing was cleared.");
    const zip = zipSync(entries, { level: 1 });
    if (zip.length > MAX_ARCHIVE_BYTES || parseManifest(unzipSync(zip)).archiveId !== archiveId) throw new Error("The recovery archive could not be verified. Nothing was cleared.");
    const digest = await sha256(zip);
    const key = await archiveKey(ownerId, archiveId);
    const saved = await bucket().put(key, zip, { httpMetadata: { contentType: "application/zip" }, customMetadata: {
      sha256: digest, createdAt, opportunityCount: String(counts.opportunities), wordFileCount: String(wordFiles.length),
    } });
    if (!saved) throw new Error("The recovery archive could not be saved. Nothing was cleared.");
    const verified = await readResetArchive(ownerId, archiveId);
    if (!verified || verified.manifest.counts.opportunities !== counts.opportunities || await sha256(verified.bytes) !== digest) {
      throw new Error("The recovery archive failed read-back verification. Nothing was cleared.");
    }

    // D1 batch is transactional. The reset lock remains until post-delete checks finish.
    const statements = TABLES.map((table) => db().prepare(`DELETE FROM ${table} WHERE owner_id=?`).bind(ownerId));
    await db().batch(statements);
    const remaining = await activeCounts(ownerId);
    if (Object.values(remaining).some((value) => value !== 0)) throw new Error("The active collection did not fully clear. The verified recovery archive remains available.");

    let retiredWordFilesPending = 0;
    for (const word of wordFiles) {
      try { await bucket().delete(word.objectKey); }
      catch { retiredWordFilesPending++; }
    }
    return { archive: verified.archive, retiredWordFilesPending };
  } finally {
    await db().prepare("DELETE FROM run_locks WHERE owner_id=? AND run_id=?").bind(ownerId, resetId).run();
  }
}

export async function deleteResetArchive(ownerId: string, archiveId: string): Promise<boolean> {
  const activeLock = await db().prepare("SELECT run_id FROM run_locks WHERE owner_id=? AND expires_at>=? LIMIT 1")
    .bind(ownerId, new Date().toISOString()).first<{ run_id: string }>();
  if (activeLock) throw new Error("Wait for the active workflow to finish before deleting a recovery archive.");
  const archived = await readResetArchive(ownerId, archiveId);
  if (!archived) return false;
  const allowedPrefix = await materialPrefix(ownerId);
  for (const word of archived.manifest.wordFiles) {
    if (!word.objectKey.startsWith(allowedPrefix)) throw new Error("The archive contains an unexpected Word-draft path.");
    const active = await db().prepare("SELECT id FROM application_materials WHERE owner_id=? AND object_key=? LIMIT 1")
      .bind(ownerId, word.objectKey).first<{ id: string }>();
    if (active) throw new Error("This archive still references an active Word draft and cannot be deleted.");
    await bucket().delete(word.objectKey);
  }
  await bucket().delete(await archiveKey(ownerId, archiveId));
  if (await bucket().head(await archiveKey(ownerId, archiveId))) throw new Error("The archive deletion could not be verified.");
  return true;
}
