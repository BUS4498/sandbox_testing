import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import mammoth from "mammoth";

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_PROFILE_CHARACTERS = 60_000;
const PDFJS_STANDARD_FONTS = `${path.join(path.dirname(fileURLToPath(import.meta.resolve("pdfjs-dist/package.json"))), "standard_fonts")}/`;
const SUPPORTED_EXTENSIONS = new Set([".docx", ".pdf", ".md", ".txt"]);
const SETUP_MODES = new Set(["REAL", "DEMO"]);
const WORK_ARRANGEMENTS = new Set(["REMOTE", "HYBRID", "ONSITE"]);
const PAID_REQUIREMENTS = new Set(["REQUIRED", "PREFERRED", "NO_RESTRICTION"]);
const RELOCATION_OPTIONS = new Set(["NO", "YES", "CONDITIONAL"]);
const WORK_AUTHORIZATION_OPTIONS = new Set(["AUTHORIZED_NO_SPONSORSHIP", "REQUIRES_SPONSORSHIP", "UNSURE_OR_PREFER_NOT_TO_STATE"]);
const SECTION_HEADING = /^(education|professional summary|summary|objective|skills|technical skills|experience|work experience|employment|projects|academic projects|coursework|certifications|leadership|activities)\b/i;
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const PHONE_PATTERN = /(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}/;
const URL_PATTERN = /\b(?:https?:\/\/|www\.|linkedin\.com|github\.com)\S*/i;
const STREET_PATTERN = /\b\d{1,6}\s+[A-Za-z0-9.' -]+\s(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr|Court|Ct|Way)\b/i;

export const DEFAULT_ROLE_CHOICES = Object.freeze([
  "AI Business Analyst Intern",
  "AI Systems Analyst Intern",
  "Business Process Automation Analyst Intern",
  "AI Product Analyst Intern",
  "Business Systems Analyst Intern",
  "Data or Business Intelligence Analyst Intern",
  "AI Transformation or Technology Consulting Intern",
]);

export class StudentSetupIncompleteError extends Error {
  constructor(missingItems) {
    super(`Complete student setup before collection or assessment: ${missingItems.join("; ")}.`);
    this.name = "StudentSetupIncompleteError";
    this.code = "STUDENT_SETUP_INCOMPLETE";
    this.missingItems = [...missingItems];
  }
}

export class LocalStudentProfileStore {
  constructor({ rootDir, clock = () => new Date(), idFactory = randomUUID } = {}) {
    if (!rootDir) throw new TypeError("LocalStudentProfileStore requires rootDir.");
    this.rootDir = path.resolve(rootDir);
    this.metadataPath = path.join(this.rootDir, "profile.json");
    this.pendingPreviewPath = path.join(this.rootDir, "pending-profile.md");
    this.confirmedProfilePath = path.join(this.rootDir, "confirmed-profile.md");
    this.studentContextPath = path.join(this.rootDir, "preferences-and-constraints.json");
    this.clock = clock;
    this.idFactory = idFactory;
  }

  async initialize() {
    await mkdir(this.rootDir, { recursive: true });
    return this;
  }

  async snapshot() {
    const metadata = await this.#readMetadata();
    const studentContext = await this.#readStudentContext();
    const pendingPreview = metadata.pending ? await readTextIfAvailable(this.pendingPreviewPath) : null;
    const confirmedPreview = metadata.confirmed ? await readTextIfAvailable(this.confirmedProfilePath) : null;
    const demoActive = metadata.mode === "DEMO";
    const realSelected = metadata.mode === "REAL";
    const resumeReady = Boolean(metadata.confirmed && confirmedPreview);
    const contextReady = Boolean(studentContext?.confirmedAt);
    const realReady = realSelected && resumeReady && contextReady;
    const readyForCollection = demoActive || realReady;
    const missingItems = setupMissingItems({ mode: metadata.mode, resumeReady, contextReady });
    return {
      status: demoActive
        ? "SYNTHETIC_DEMONSTRATION_ACTIVE"
        : realReady
          ? "REAL_STUDENT_READY"
        : metadata.pending
          ? "AWAITING_CONFIRMATION"
          : "SETUP_INCOMPLETE",
      mode: metadata.mode,
      readyForCollection,
      missingItems,
      activeSource: demoActive ? "SYNTHETIC_DEMONSTRATION" : realReady ? "PRIVATE_CONFIRMED" : "SETUP_INCOMPLETE",
      activeLabel: demoActive ? "Synthetic demonstration setup" : realReady ? "Confirmed real-student setup" : "Student setup incomplete",
      pending: metadata.pending ? publicFileMetadata(metadata.pending) : null,
      confirmed: metadata.confirmed ? publicFileMetadata(metadata.confirmed) : null,
      previewText: pendingPreview || (realSelected && resumeReady ? confirmedPreview : null),
      requiresConfirmation: Boolean(metadata.pending),
      preferencesSource: demoActive ? "Synthetic career-preferences.md" : contextReady ? "Confirmed local student preferences" : "Not confirmed",
      constraintsSource: demoActive ? "Synthetic availability-and-constraints.md" : contextReady ? "Confirmed local availability and constraints" : "Not confirmed",
      preferencesAndConstraints: studentContext ? publicStudentContext(studentContext) : null,
      defaultRoleChoices: [...DEFAULT_ROLE_CHOICES],
    };
  }

  async uploadResume({ fileName, mediaType = "", bytes } = {}) {
    const safeName = safeBaseName(fileName);
    const extension = path.extname(safeName).toLowerCase();
    const buffer = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes ?? []);
    if (!SUPPORTED_EXTENSIONS.has(extension)) throw new TypeError("Choose a .docx, .pdf, .md, or .txt resume file.");
    if (buffer.length === 0) throw new TypeError("The selected resume file is empty.");
    if (buffer.length > MAX_FILE_BYTES) throw new TypeError("The resume file must be 5 MB or smaller.");
    validateFileSignature(extension, buffer);

    const extracted = normalizeExtractedText(await extractResumeText(extension, buffer));
    if (extracted.length < 40) throw new TypeError("The resume did not contain enough readable text to review.");
    const preview = reduceDirectIdentifiers(extracted);
    if (preview.length < 40) throw new TypeError("Too little resume content remained after removing contact details.");

    await mkdir(this.rootDir, { recursive: true });
    const identifier = this.idFactory();
    const storedFileName = `resume-${identifier}${extension}`;
    await writeFile(path.join(this.rootDir, storedFileName), buffer, { flag: "wx" });
    await atomicWrite(this.pendingPreviewPath, `${preview.trim()}\n`);
    const metadata = await this.#readMetadata();
    metadata.pending = {
      fileName: safeName,
      storedFileName,
      mediaType: String(mediaType || mediaTypeFor(extension)),
      sizeBytes: buffer.length,
      uploadedAt: this.clock().toISOString(),
      sourceHash: sha256(buffer),
    };
    await this.#writeMetadata(metadata);
    return this.snapshot();
  }

  async confirmProfile({ profileText, identifyingDetailsRemoved } = {}) {
    const metadata = await this.#readMetadata();
    if (!metadata.pending) throw new TypeError("Upload and review a resume before confirming the private profile.");
    if (identifyingDetailsRemoved !== true) throw new TypeError("Confirm that direct identifiers were reviewed and removed.");
    const normalized = normalizeConfirmedProfile(profileText);
    const directIdentifier = directIdentifierLabel(normalized);
    if (directIdentifier) throw new TypeError(`Remove the detected ${directIdentifier} before confirming this profile.`);
    await atomicWrite(this.confirmedProfilePath, `${normalized.trim()}\n`);
    metadata.confirmed = {
      ...metadata.pending,
      confirmedAt: this.clock().toISOString(),
      profileHash: sha256(Buffer.from(normalized, "utf8")),
    };
    metadata.pending = null;
    metadata.active = true;
    metadata.mode = "REAL";
    await this.#writeMetadata(metadata);
    return this.snapshot();
  }

  async savePreferencesAndConstraints(input = {}) {
    const studentContext = normalizeStudentContext(input, this.clock().toISOString());
    await mkdir(this.rootDir, { recursive: true });
    await atomicWrite(this.studentContextPath, `${JSON.stringify(studentContext, null, 2)}\n`);
    const metadata = await this.#readMetadata();
    metadata.mode = "REAL";
    metadata.active = Boolean(metadata.confirmed);
    await this.#writeMetadata(metadata);
    return this.snapshot();
  }

  async activateDemo() {
    const metadata = await this.#readMetadata();
    metadata.mode = "DEMO";
    metadata.active = false;
    await this.#writeMetadata(metadata);
    return this.snapshot();
  }

  async activateReal() {
    const metadata = await this.#readMetadata();
    metadata.mode = "REAL";
    metadata.active = Boolean(metadata.confirmed);
    await this.#writeMetadata(metadata);
    return this.snapshot();
  }

  async deactivate() {
    const metadata = await this.#readMetadata();
    metadata.active = false;
    metadata.mode = null;
    await this.#writeMetadata(metadata);
    return this.snapshot();
  }

  async activeResumeContext({ syntheticPath } = {}) {
    const metadata = await this.#readMetadata();
    if (metadata.mode === "REAL" && metadata.confirmed) {
      const profile = await readTextIfAvailable(this.confirmedProfilePath);
      if (profile) {
        return {
          sourceType: "PRIVATE_CONFIRMED",
          sourceLabel: "Student-confirmed private non-identifying resume profile",
          content: profile,
          confirmedAt: metadata.confirmed.confirmedAt,
        };
      }
    }
    if (metadata.mode !== "DEMO") throw new StudentSetupIncompleteError(setupMissingItems({ mode: metadata.mode, resumeReady: Boolean(metadata.confirmed), contextReady: Boolean(await this.#readStudentContext()) }));
    if (!syntheticPath) throw new TypeError("A synthetic demonstration path is required in demonstration mode.");
    return {
      sourceType: "SYNTHETIC_DEMONSTRATION",
      sourceLabel: "Synthetic demonstration resume profile",
      content: await readFile(syntheticPath, "utf8"),
      confirmedAt: null,
    };
  }

  async activeStudentContext({ syntheticResumePath, syntheticPreferencesPath, syntheticConstraintsPath } = {}) {
    const snapshot = await this.snapshot();
    if (!snapshot.readyForCollection) throw new StudentSetupIncompleteError(snapshot.missingItems);
    if (snapshot.mode === "DEMO") {
      if (!syntheticResumePath || !syntheticPreferencesPath || !syntheticConstraintsPath) {
        throw new TypeError("All synthetic demonstration context paths are required in demonstration mode.");
      }
      return {
        mode: "DEMO",
        sourceType: "SYNTHETIC_DEMONSTRATION",
        sourceLabel: "Explicitly selected synthetic demonstration setup",
        confirmedAt: null,
        resume: await readFile(syntheticResumePath, "utf8"),
        preferences: await readFile(syntheticPreferencesPath, "utf8"),
        constraints: await readFile(syntheticConstraintsPath, "utf8"),
      };
    }
    return {
      mode: "REAL",
      sourceType: "PRIVATE_CONFIRMED",
      sourceLabel: "Student-confirmed private non-identifying setup",
      confirmedAt: snapshot.preferencesAndConstraints.confirmedAt,
      resume: await readFile(this.confirmedProfilePath, "utf8"),
      preferencesAndConstraints: snapshot.preferencesAndConstraints,
    };
  }

  async #readMetadata() {
    try {
      const value = JSON.parse(await readFile(this.metadataPath, "utf8"));
      const legacyMode = value.mode === undefined ? (value.active && value.confirmed ? "REAL" : null) : value.mode;
      return { version: 2, mode: SETUP_MODES.has(legacyMode) ? legacyMode : null, active: Boolean(value.active), confirmed: value.confirmed ?? null, pending: value.pending ?? null };
    } catch (error) {
      if (error.code === "ENOENT") return { version: 2, mode: null, active: false, confirmed: null, pending: null };
      if (error instanceof SyntaxError) throw new Error("The local student-profile metadata is unreadable.", { cause: error });
      throw error;
    }
  }

  async #writeMetadata(metadata) {
    await atomicWrite(this.metadataPath, `${JSON.stringify({ ...metadata, version: 2 }, null, 2)}\n`);
  }

  async #readStudentContext() {
    try {
      const value = JSON.parse(await readFile(this.studentContextPath, "utf8"));
      return normalizeStoredStudentContext(value);
    } catch (error) {
      if (error.code === "ENOENT") return null;
      if (error instanceof SyntaxError || error instanceof TypeError) throw new Error("The local preference-and-constraint record is unreadable.", { cause: error });
      throw error;
    }
  }
}

function setupMissingItems({ mode, resumeReady, contextReady }) {
  if (!SETUP_MODES.has(mode)) return ["Choose real student setup or synthetic demonstration setup"];
  if (mode === "DEMO") return [];
  const missing = [];
  if (!resumeReady) missing.push("Upload and confirm a resume");
  if (!contextReady) missing.push("Save preferred roles, availability, and constraints");
  return missing;
}

function normalizeStudentContext(value, confirmedAt) {
  if (value.confirmed !== true) throw new TypeError("Confirm that these preferences and constraints are accurate before saving.");
  const selectedRoles = normalizeStringArray(value.preferredRoles, { maxItems: 12, maxLength: 120 });
  const customRole = normalizeOptionalText(value.customRole, 120);
  const preferredRoles = [...new Set([...selectedRoles, ...(customRole ? [customRole] : [])])];
  if (preferredRoles.length === 0) throw new TypeError("Select at least one preferred internship role or add a custom role.");
  const availabilityStart = normalizeDate(value.availabilityStart, "Internship start date");
  const availabilityEnd = normalizeDate(value.availabilityEnd, "Internship end date");
  if (availabilityEnd < availabilityStart) throw new TypeError("The internship end date must be on or after the start date.");
  const hoursPerWeek = Number(value.hoursPerWeek);
  if (!Number.isInteger(hoursPerWeek) || hoursPerWeek < 1 || hoursPerWeek > 80) throw new TypeError("Weekly availability must be a whole number from 1 to 80 hours.");
  const workArrangements = normalizeEnumArray(value.workArrangements, WORK_ARRANGEMENTS, "Select at least one acceptable work arrangement.");
  const geographicLimits = normalizeRequiredText(value.geographicLimits, 500, "Geographic boundaries are required.");
  const paidRequirement = normalizeEnum(value.paidRequirement, PAID_REQUIREMENTS, "Choose a paid-internship preference.");
  const relocation = normalizeEnum(value.relocation, RELOCATION_OPTIONS, "Choose a relocation preference.");
  const workAuthorization = normalizeEnum(value.workAuthorization, WORK_AUTHORIZATION_OPTIONS, "Choose a work-authorization or sponsorship status.");
  const additionalConstraints = normalizeOptionalText(value.additionalConstraints, 1_000);
  const directIdentifier = directIdentifierLabel(`${geographicLimits}\n${additionalConstraints}`);
  if (directIdentifier) throw new TypeError(`Remove the detected ${directIdentifier} from the preference-and-constraint form.`);
  return {
    version: 1,
    preferredRoles,
    availabilityStart,
    availabilityEnd,
    hoursPerWeek,
    workArrangements,
    geographicLimits,
    paidRequirement,
    relocation,
    workAuthorization,
    additionalConstraints,
    confirmedAt,
  };
}

function normalizeStoredStudentContext(value) {
  return normalizeStudentContext({ ...value, confirmed: true }, String(value.confirmedAt || ""));
}

function publicStudentContext(value) {
  return {
    preferredRoles: [...value.preferredRoles],
    availabilityStart: value.availabilityStart,
    availabilityEnd: value.availabilityEnd,
    hoursPerWeek: value.hoursPerWeek,
    workArrangements: [...value.workArrangements],
    geographicLimits: value.geographicLimits,
    paidRequirement: value.paidRequirement,
    relocation: value.relocation,
    workAuthorization: value.workAuthorization,
    additionalConstraints: value.additionalConstraints,
    confirmedAt: value.confirmedAt,
  };
}

function normalizeStringArray(value, { maxItems, maxLength }) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, maxItems).map((item) => normalizeOptionalText(item, maxLength)).filter(Boolean);
}

function normalizeEnumArray(value, allowed, message) {
  const normalized = [...new Set((Array.isArray(value) ? value : []).map((item) => String(item || "").trim().toUpperCase()))]
    .filter((item) => allowed.has(item));
  if (normalized.length === 0) throw new TypeError(message);
  return normalized;
}

function normalizeEnum(value, allowed, message) {
  const normalized = String(value || "").trim().toUpperCase();
  if (!allowed.has(normalized)) throw new TypeError(message);
  return normalized;
}

function normalizeDate(value, label) {
  const normalized = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized) || Number.isNaN(new Date(`${normalized}T00:00:00Z`).valueOf())) throw new TypeError(`${label} is required.`);
  return normalized;
}

function normalizeRequiredText(value, maxLength, message) {
  const normalized = normalizeOptionalText(value, maxLength);
  if (!normalized) throw new TypeError(message);
  return normalized;
}

function normalizeOptionalText(value, maxLength) {
  return String(value || "").replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

async function extractResumeText(extension, buffer) {
  if ([".md", ".txt"].includes(extension)) return buffer.toString("utf8");
  if (extension === ".docx") return (await mammoth.extractRawText({ buffer })).value;
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const task = getDocument({ data: new Uint8Array(buffer), isEvalSupported: false, useWorkerFetch: false, standardFontDataUrl: PDFJS_STANDARD_FONTS });
  const document = await task.promise;
  try {
    if (document.numPages > 20) throw new TypeError("The resume PDF must contain 20 pages or fewer.");
    const pages = [];
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      pages.push(content.items.map((item) => String(item.str ?? "")).join(" "));
    }
    return pages.join("\n\n");
  } finally {
    await task.destroy();
  }
}

function normalizeExtractedText(value) {
  return String(value ?? "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, MAX_PROFILE_CHARACTERS);
}

function reduceDirectIdentifiers(value) {
  const lines = normalizeExtractedText(value).split("\n").map((line) => line.trim()).filter(Boolean);
  const firstSection = lines.findIndex((line) => SECTION_HEADING.test(line));
  const body = firstSection > 0 ? lines.slice(firstSection) : lines;
  return body.filter((line) => !EMAIL_PATTERN.test(line) && !PHONE_PATTERN.test(line) && !URL_PATTERN.test(line) && !STREET_PATTERN.test(line)).join("\n");
}

function normalizeConfirmedProfile(value) {
  const normalized = normalizeExtractedText(value);
  if (normalized.length < 40) throw new TypeError("The confirmed agent-facing profile needs at least 40 readable characters.");
  return normalized;
}

function directIdentifierLabel(value) {
  if (EMAIL_PATTERN.test(value)) return "email address";
  if (PHONE_PATTERN.test(value)) return "phone number";
  if (URL_PATTERN.test(value)) return "personal URL";
  if (STREET_PATTERN.test(value)) return "street address";
  return null;
}

function validateFileSignature(extension, buffer) {
  if (extension === ".pdf" && buffer.subarray(0, 5).toString("ascii") !== "%PDF-") throw new TypeError("The selected file is not a readable PDF.");
  if (extension === ".docx" && buffer.subarray(0, 2).toString("ascii") !== "PK") throw new TypeError("The selected file is not a readable DOCX document.");
  if ([".md", ".txt"].includes(extension) && buffer.includes(0)) throw new TypeError("The selected text resume appears to be a binary file.");
}

function safeBaseName(value) {
  const baseName = path.basename(String(value ?? "")).replace(/[\u0000-\u001F<>:"/\\|?*]/g, "_").trim();
  if (!baseName) throw new TypeError("A resume file name is required.");
  return baseName.slice(0, 160);
}

function mediaTypeFor(extension) {
  return ({
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".pdf": "application/pdf",
    ".md": "text/markdown",
    ".txt": "text/plain",
  })[extension];
}

function publicFileMetadata(value) {
  return {
    fileName: value.fileName,
    mediaType: value.mediaType,
    sizeBytes: value.sizeBytes,
    uploadedAt: value.uploadedAt,
    confirmedAt: value.confirmedAt ?? null,
  };
}

async function readTextIfAvailable(filePath) {
  try { return await readFile(filePath, "utf8"); } catch (error) { if (error.code === "ENOENT") return null; throw error; }
}

async function atomicWrite(filePath, content) {
  const temporaryPath = `${filePath}.${randomUUID()}.tmp`;
  await writeFile(temporaryPath, content, { encoding: "utf8", flag: "wx" });
  try {
    await rename(temporaryPath, filePath);
  } catch (error) {
    if (!["EEXIST", "EPERM"].includes(error?.code)) throw error;
    await rm(filePath, { force: true });
    await rename(temporaryPath, filePath);
  }
}

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}
