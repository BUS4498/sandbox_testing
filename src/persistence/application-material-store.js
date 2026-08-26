import { randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";

const ALLOWED_TYPES = new Map([
  ["RESUME_TAILORING_CHECKLIST", "resume-tailoring-checklist"],
  ["COVER_LETTER_OUTLINE", "cover-letter-outline"],
  ["APPLICATION_QUESTION_WORKSHEET", "application-question-worksheet"],
]);

export class LocalApplicationMaterialStore {
  #queue = Promise.resolve();

  constructor({ rootDir, clock = () => new Date(), idFactory = randomUUID }) {
    if (!rootDir) throw new TypeError("LocalApplicationMaterialStore requires rootDir.");
    this.rootDir = path.resolve(rootDir);
    this.clock = clock;
    this.idFactory = idFactory;
  }

  async initialize() {
    await mkdir(this.rootDir, { recursive: true });
    return this;
  }

  saveTemplate({ opportunityId, company, roleTitle, type, title, markdown, placeholders = [], runId }) {
    return this.#enqueue(async () => {
      if (!opportunityId) throw new TypeError("opportunityId is required for an application template.");
      if (!ALLOWED_TYPES.has(type)) throw new TypeError(`Unsupported application template type: ${type}.`);
      const safeMarkdown = cleanMarkdown(markdown);
      const materialId = this.idFactory();
      const createdAt = this.clock().toISOString();
      const directory = path.join(this.rootDir, safeSegment(opportunityId));
      await mkdir(directory, { recursive: true });
      const fileName = `${ALLOWED_TYPES.get(type)}-${createdAt.slice(0, 10)}-${safeSegment(materialId)}.md`;
      const filePath = path.join(directory, fileName);
      const metadataPath = `${filePath}.json`;
      const header = [
        "# Draft template — student review required",
        "",
        `**Opportunity:** ${cleanInline(company)} — ${cleanInline(roleTitle)}`,
        `**Template:** ${cleanInline(title)}`,
        `**Created:** ${createdAt}`,
        "",
        "> This draft is a preparation aid. Verify every claim, revise it in your own voice, and submit it yourself only after review.",
        "",
      ].join("\n");
      const metadata = {
        schemaVersion: 1,
        materialId,
        opportunityId: String(opportunityId),
        runId: runId ? String(runId) : null,
        type,
        title: cleanInline(title),
        createdAt,
        status: "DRAFT_REVIEW_REQUIRED",
        placeholders: cleanStringArray(placeholders, 30),
        fileName,
      };
      await atomicWrite(filePath, `${header}${safeMarkdown.trim()}\n`);
      await atomicWrite(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`);
      return this.readMaterial(materialId);
    });
  }

  async listMaterials({ opportunityId } = {}) {
    let opportunityDirectories;
    try {
      opportunityDirectories = opportunityId
        ? [safeSegment(opportunityId)]
        : (await readdir(this.rootDir, { withFileTypes: true })).filter((entry) => entry.isDirectory()).map((entry) => entry.name);
    } catch (error) {
      if (error.code === "ENOENT") return [];
      throw error;
    }
    const materials = [];
    for (const directoryName of opportunityDirectories) {
      const directory = path.join(this.rootDir, directoryName);
      let files;
      try {
        files = await readdir(directory);
      } catch (error) {
        if (error.code === "ENOENT") continue;
        throw error;
      }
      for (const file of files.filter((name) => name.endsWith(".md.json"))) {
        const metadata = JSON.parse(await readFile(path.join(directory, file), "utf8"));
        materials.push(publicMetadata(metadata));
      }
    }
    return materials.sort((left, right) => String(left.createdAt).localeCompare(String(right.createdAt)));
  }

  async readMaterial(materialId) {
    if (!materialId) throw new TypeError("materialId is required.");
    const metadata = (await this.listMaterials()).find((item) => item.materialId === materialId);
    if (!metadata) return null;
    const filePath = path.join(this.rootDir, safeSegment(metadata.opportunityId), metadata.fileName);
    const markdown = await readFile(filePath, "utf8");
    return { ...metadata, markdown, verified: markdown.startsWith("# Draft template — student review required") };
  }

  #enqueue(operation) {
    const queued = this.#queue.then(operation, operation);
    this.#queue = queued.catch(() => undefined);
    return queued;
  }
}

function publicMetadata(value) {
  return {
    materialId: String(value.materialId),
    opportunityId: String(value.opportunityId),
    runId: value.runId ? String(value.runId) : null,
    type: String(value.type),
    title: cleanInline(value.title),
    createdAt: String(value.createdAt),
    status: "DRAFT_REVIEW_REQUIRED",
    placeholders: cleanStringArray(value.placeholders, 30),
    fileName: path.basename(String(value.fileName)),
  };
}

function cleanMarkdown(value) {
  const text = String(value ?? "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
  if (!text.trim()) throw new TypeError("Application template content is required.");
  if (text.length > 20_000) throw new TypeError("Application template content exceeded the local size limit.");
  return text;
}

function cleanInline(value) {
  return String(value ?? "").replace(/[\r\n\u0000-\u001F]/g, " ").trim().slice(0, 300) || "Unknown";
}

function cleanStringArray(value, limit) {
  if (!Array.isArray(value) || value.length > limit) throw new TypeError("Application template placeholders are invalid.");
  return value.map(cleanInline);
}

function safeSegment(value) {
  const segment = String(value).replace(/[^A-Za-z0-9._-]/g, "-").slice(0, 120);
  if (!segment || segment === "." || segment === "..") throw new TypeError("A safe local identifier is required.");
  return segment;
}

async function atomicWrite(filePath, content) {
  const temporaryPath = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
  await writeFile(temporaryPath, content, { encoding: "utf8", flag: "wx", mode: 0o600 });
  await rename(temporaryPath, filePath);
}
