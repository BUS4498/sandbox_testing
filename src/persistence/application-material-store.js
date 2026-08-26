import { randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  HeadingLevel,
  LevelFormat,
  Packer,
  PageNumber,
  Paragraph,
  ShadingType,
  TextRun,
} from "docx";

const WORD_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const ALLOWED_TYPES = new Map([
  ["RESUME_TAILORING_CHECKLIST", "resume-tailoring-checklist"],
  ["COVER_LETTER_OUTLINE", "cover-letter-outline"],
  ["APPLICATION_QUESTION_WORKSHEET", "application-question-worksheet"],
]);

const COLORS = Object.freeze({
  ink: "17343B",
  teal: "0D7772",
  muted: "5B6E73",
  noticeFill: "FFF4DE",
  noticeBorder: "D6A239",
  placeholderFill: "EAF5F2",
});

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
      const safeContent = cleanContent(markdown);
      const safePlaceholders = cleanStringArray(placeholders, 30);
      const materialId = this.idFactory();
      const createdAt = this.clock().toISOString();
      const directory = path.join(this.rootDir, safeSegment(opportunityId));
      await mkdir(directory, { recursive: true });
      const fileName = `${ALLOWED_TYPES.get(type)}-${createdAt.slice(0, 10)}-${safeSegment(materialId)}.docx`;
      const filePath = path.join(directory, fileName);
      const metadataPath = `${filePath}.json`;
      const metadata = {
        schemaVersion: 2,
        materialId,
        opportunityId: String(opportunityId),
        runId: runId ? String(runId) : null,
        type,
        title: cleanInline(title),
        createdAt,
        status: "DRAFT_REVIEW_REQUIRED",
        placeholders: safePlaceholders,
        fileName,
        contentType: WORD_MIME,
        format: "DOCX",
      };
      const document = buildWordTemplate({
        company: cleanInline(company),
        roleTitle: cleanInline(roleTitle),
        title: metadata.title,
        createdAt,
        content: safeContent,
        placeholders: safePlaceholders,
      });
      const buffer = await Packer.toBuffer(document);
      await atomicWriteBuffer(filePath, buffer);
      await atomicWriteText(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`);
      return { ...publicMetadata(metadata), verified: await verifyWordFile(filePath) };
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
      for (const file of files.filter((name) => name.endsWith(".docx.json"))) {
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
    const bytes = await readFile(filePath);
    return { ...metadata, bytes, verified: isWordPackage(bytes) };
  }

  #enqueue(operation) {
    const queued = this.#queue.then(operation, operation);
    this.#queue = queued.catch(() => undefined);
    return queued;
  }
}

function buildWordTemplate({ company, roleTitle, title, createdAt, content, placeholders }) {
  const body = [
    new Paragraph({
      children: [new TextRun({ text: "INTERNSHIP APPLICATION PREPARATION", bold: true, size: 18, color: COLORS.teal, characterSpacing: 80 })],
      spacing: { before: 0, after: 80 },
    }),
    new Paragraph({
      children: [new TextRun({ text: title, bold: true, size: 48, color: COLORS.ink })],
      spacing: { before: 0, after: 100 },
      keepNext: true,
    }),
    new Paragraph({
      children: [new TextRun({ text: `${company} — ${roleTitle}`, size: 24, color: COLORS.muted })],
      spacing: { before: 0, after: 220 },
      keepNext: true,
    }),
    new Paragraph({
      children: [
        new TextRun({ text: "DRAFT TEMPLATE — STUDENT REVIEW REQUIRED. ", bold: true, color: COLORS.ink }),
        new TextRun({ text: "This preparation aid is not a final application material. Verify every claim, revise it in your own voice, and submit it yourself only after review.", color: COLORS.ink }),
      ],
      shading: { type: ShadingType.CLEAR, fill: COLORS.noticeFill, color: "auto" },
      border: { left: { style: BorderStyle.SINGLE, color: COLORS.noticeBorder, size: 18, space: 8 } },
      spacing: { before: 0, after: 220 },
      indent: { left: 180, right: 120 },
    }),
    ...markdownToParagraphs(content),
  ];

  if (placeholders.length > 0) {
    body.push(
      new Paragraph({ text: "Items to complete before use", heading: HeadingLevel.HEADING_1 }),
      ...placeholders.map((placeholder) => new Paragraph({
        children: [new TextRun({ text: `☐ ${placeholder}`, color: COLORS.ink })],
        shading: { type: ShadingType.CLEAR, fill: COLORS.placeholderFill, color: "auto" },
        spacing: { before: 0, after: 80 },
        indent: { left: 160, right: 120 },
      })),
    );
  }

  body.push(
    new Paragraph({ text: "Student review checklist", heading: HeadingLevel.HEADING_1 }),
    ...[
      "Confirm every qualification and accomplishment against the verified student context.",
      "Replace or resolve every visible placeholder.",
      "Revise the wording in your own voice and check the employer’s current instructions.",
      "Treat this document as a preparation aid; nothing has been submitted or sent.",
    ].map((item) => new Paragraph({ text: item, numbering: { reference: "review-checklist", level: 0 } })),
  );

  return new Document({
    creator: "Internship Application Prep Agent",
    title,
    description: "Review-only internship application preparation template",
    styles: {
      default: {
        document: {
          run: { font: "Calibri", size: 22, color: COLORS.ink },
          paragraph: { spacing: { before: 0, after: 120, line: 300, lineRule: "auto" } },
        },
      },
      paragraphStyles: [
        { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: "Calibri", size: 32, bold: true, color: COLORS.teal }, paragraph: { spacing: { before: 360, after: 200 }, keepNext: true, outlineLevel: 0 } },
        { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: "Calibri", size: 26, bold: true, color: COLORS.teal }, paragraph: { spacing: { before: 280, after: 140 }, keepNext: true, outlineLevel: 1 } },
        { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: "Calibri", size: 24, bold: true, color: COLORS.ink }, paragraph: { spacing: { before: 200, after: 100 }, keepNext: true, outlineLevel: 2 } },
      ],
    },
    numbering: {
      config: [
        { reference: "draft-bullets", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 270 }, spacing: { after: 80, line: 300, lineRule: "auto" } } } }] },
        { reference: "draft-numbers", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 270 }, spacing: { after: 80, line: 300, lineRule: "auto" } } } }] },
        { reference: "review-checklist", levels: [{ level: 0, format: LevelFormat.BULLET, text: "☐", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 270 }, spacing: { after: 80, line: 300, lineRule: "auto" } } } }] },
      ],
    },
    sections: [{
      properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440, header: 708, footer: 708 } } },
      headers: { default: new Header({ children: [new Paragraph({ children: [new TextRun({ text: "Internship Application Prep Agent  |  Review-only Word draft", size: 18, color: COLORS.muted })], spacing: { after: 80 } })] }) },
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: `Created ${createdAt.slice(0, 10)}  |  Student review required  |  Page `, size: 18, color: COLORS.muted }), new TextRun({ children: [PageNumber.CURRENT], size: 18, color: COLORS.muted })] })] }) },
      children: body,
    }],
  });
}

function markdownToParagraphs(markdown) {
  const paragraphs = [];
  let pending = [];
  const flush = () => {
    if (pending.length === 0) return;
    paragraphs.push(new Paragraph({ children: inlineRuns(pending.join(" ")), spacing: { before: 0, after: 120, line: 300, lineRule: "auto" } }));
    pending = [];
  };

  for (const rawLine of markdown.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) { flush(); continue; }
    if (/^---+$/.test(line)) { flush(); continue; }
    const heading = line.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      flush();
      const level = heading[1].length <= 2 ? HeadingLevel.HEADING_1 : heading[1].length === 3 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3;
      paragraphs.push(new Paragraph({ children: inlineRuns(heading[2]), heading: level }));
      continue;
    }
    const checkbox = line.match(/^[-*]\s+\[([ xX])\]\s+(.+)$/);
    if (checkbox) {
      flush();
      paragraphs.push(new Paragraph({ children: inlineRuns(`${checkbox[1].trim() ? "☒" : "☐"} ${checkbox[2]}`), spacing: { after: 80 }, indent: { left: 540, hanging: 270 } }));
      continue;
    }
    const bullet = line.match(/^[-*]\s+(.+)$/);
    if (bullet) {
      flush();
      paragraphs.push(new Paragraph({ children: inlineRuns(bullet[1]), numbering: { reference: "draft-bullets", level: 0 } }));
      continue;
    }
    const number = line.match(/^\d+[.)]\s+(.+)$/);
    if (number) {
      flush();
      paragraphs.push(new Paragraph({ children: inlineRuns(number[1]), numbering: { reference: "draft-numbers", level: 0 } }));
      continue;
    }
    const quote = line.match(/^>\s?(.+)$/);
    if (quote) {
      flush();
      paragraphs.push(new Paragraph({ children: inlineRuns(quote[1], { italics: true, color: COLORS.muted }), indent: { left: 360, right: 180 }, spacing: { after: 140 } }));
      continue;
    }
    pending.push(line);
  }
  flush();
  return paragraphs;
}

function inlineRuns(value, defaults = {}) {
  const normalized = String(value).replace(/\[([^\]]+)]\((https?:\/\/[^)]+)\)/g, "$1 ($2)");
  const tokens = normalized.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g).filter(Boolean);
  return tokens.map((token) => {
    if (token.startsWith("**") && token.endsWith("**")) return new TextRun({ text: token.slice(2, -2), bold: true, ...defaults });
    if (token.startsWith("`") && token.endsWith("`")) return new TextRun({ text: token.slice(1, -1), font: "Consolas", color: COLORS.teal, ...defaults });
    if (token.startsWith("*") && token.endsWith("*")) return new TextRun({ text: token.slice(1, -1), italics: true, ...defaults });
    return new TextRun({ text: token, ...defaults });
  });
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
    contentType: WORD_MIME,
    format: "DOCX",
  };
}

function cleanContent(value) {
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

async function verifyWordFile(filePath) {
  try { return isWordPackage(await readFile(filePath)); } catch { return false; }
}

function isWordPackage(bytes) {
  return Buffer.isBuffer(bytes) && bytes.length > 1_000 && bytes[0] === 0x50 && bytes[1] === 0x4b;
}

async function atomicWriteBuffer(filePath, content) {
  const temporaryPath = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
  await writeFile(temporaryPath, content, { flag: "wx", mode: 0o600 });
  await rename(temporaryPath, filePath);
}

async function atomicWriteText(filePath, content) {
  const temporaryPath = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
  await writeFile(temporaryPath, content, { encoding: "utf8", flag: "wx", mode: 0o600 });
  await rename(temporaryPath, filePath);
}
