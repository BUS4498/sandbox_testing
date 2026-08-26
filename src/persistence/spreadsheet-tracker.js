import { randomUUID } from "node:crypto";
import { access, copyFile, mkdir, rename, rm } from "node:fs/promises";
import path from "node:path";

import { loadArtifactTool } from "./artifact-tool-loader.js";

const SHEET_NAME = "Internships";
const TABLE_NAME = "InternshipCollection";
const POSTING_STATUSES = ["ACTIVE", "CLOSED", "UNCERTAIN"];
const APPLICATION_STATUSES = [
  "NOT STARTED",
  "PREPARING",
  "READY FOR REVIEW",
  "SUBMITTED",
  "INTERVIEWING",
  "OFFER",
  "DECLINED",
  "WITHDRAWN",
  "CLOSED",
];

export const SPREADSHEET_COLUMNS = Object.freeze([
  { key: "opportunityId", header: "Opportunity ID", width: 18 },
  { key: "recordVersion", header: "Record version", width: 12 },
  { key: "dateAdded", header: "Date added", width: 13, date: true },
  { key: "dateDiscovered", header: "Date discovered", width: 15, date: true },
  { key: "lastUpdated", header: "Last updated", width: 14, date: true },
  { key: "lastVerified", header: "Last verified", width: 14, date: true },
  { key: "company", header: "Company", width: 22 },
  { key: "roleTitle", header: "Role title", width: 28 },
  { key: "location", header: "Location", width: 20 },
  { key: "workArrangement", header: "Work arrangement", width: 16 },
  { key: "internshipPeriod", header: "Internship period", width: 18 },
  { key: "deadline", header: "Deadline", width: 13, date: true },
  { key: "source", header: "Source", width: 22 },
  { key: "postingUrl", header: "Posting URL", width: 36 },
  { key: "employerPostingId", header: "Employer posting ID", width: 20 },
  { key: "postingStatus", header: "Posting status", width: 14 },
  { key: "fitAssessment", header: "Fit assessment", width: 18 },
  { key: "agentDecision", header: "Agent decision", width: 16 },
  { key: "decisionRationale", header: "Decision rationale", width: 42 },
  { key: "applicationStatus", header: "Application status", width: 20 },
  { key: "nextAction", header: "Next action", width: 30 },
  { key: "nextActionDate", header: "Next-action date", width: 16, date: true },
  { key: "nextActionOwner", header: "Next-action owner", width: 18 },
  { key: "unresolvedIssue", header: "Unresolved issue", width: 32 },
  { key: "unresolvedIssueOwner", header: "Unresolved issue owner", width: 21 },
  { key: "lastAgentReview", header: "Last agent review", width: 17, date: true },
  { key: "studentNotes", header: "Student notes", width: 36 },
  { key: "applicationUrl", header: "Application URL", width: 36 },
]);

const STUDENT_OWNED_FIELDS = new Set(["applicationStatus", "studentNotes"]);
const AGENT_IMMUTABLE_FIELDS = new Set(["opportunityId", "dateAdded", "dateDiscovered"]);
const MATERIAL_FIELDS = new Set([
  "deadline",
  "postingStatus",
  "location",
  "workArrangement",
  "internshipPeriod",
  "applicationUrl",
  "fitAssessment",
  "agentDecision",
  "nextAction",
  "nextActionDate",
  "unresolvedIssue",
]);

export class DuplicateOpportunityError extends Error {
  constructor(result) {
    super(`Opportunity matches existing record ${result.opportunityId}.`);
    this.name = "DuplicateOpportunityError";
    this.result = result;
  }
}

export class AmbiguousDuplicateError extends Error {
  constructor(result) {
    super(`Opportunity may match existing record ${result.opportunityId}; student review is required.`);
    this.name = "AmbiguousDuplicateError";
    this.result = result;
  }
}

export class SpreadsheetConflictError extends Error {
  constructor(message) {
    super(message);
    this.name = "SpreadsheetConflictError";
  }
}

export class LocalSpreadsheetTracker {
  #writeQueue = Promise.resolve();

  constructor({ filePath, clock = () => new Date(), artifactToolModulePath, idFactory = randomUUID }) {
    if (!filePath) throw new TypeError("LocalSpreadsheetTracker requires filePath.");
    this.filePath = path.resolve(filePath);
    this.clock = clock;
    this.artifactToolModulePath = artifactToolModulePath;
    this.idFactory = idFactory;
  }

  async initialize() {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    if (!(await exists(this.filePath))) {
      await this.#writeRecords([]);
    } else {
      await this.readRecords();
    }
    return this;
  }

  async readRecords() {
    if (!(await exists(this.filePath))) return [];
    const { FileBlob, SpreadsheetFile } = await loadArtifactTool({ modulePath: this.artifactToolModulePath });
    const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load(this.filePath));
    const sheet = workbook.worksheets.getItem(SHEET_NAME);
    if (!sheet) throw new Error(`Spreadsheet is missing the required ${SHEET_NAME} worksheet.`);
    const usedRange = sheet.getUsedRange(true);
    if (!usedRange) return [];
    const rows = usedRange.values ?? [];
    if (rows.length === 0) return [];
    const headerMap = validateAndMapHeaders(rows[0]);
    return rows.slice(1).filter(isRecordRow).map((row) => rowToRecord(row, headerMap));
  }

  async getOpportunity(opportunityId) {
    const records = await this.readRecords();
    return records.find((record) => record.opportunityId === opportunityId) ?? null;
  }

  async checkDuplicate(candidate, records) {
    const currentRecords = records ?? (await this.readRecords());
    const candidateUrl = canonicalizePostingUrl(candidate.postingUrl);

    for (const existing of currentRecords) {
      if (candidate.opportunityId && candidate.opportunityId === existing.opportunityId) {
        return duplicateResult("EXACT", existing, ["opportunityId"], candidate);
      }
      if (candidateUrl && candidateUrl === canonicalizePostingUrl(existing.postingUrl)) {
        return duplicateResult("EXACT", existing, ["postingUrl"], candidate);
      }
      if (
        candidate.employerPostingId &&
        existing.employerPostingId &&
        normalize(candidate.employerPostingId) === normalize(existing.employerPostingId) &&
        normalize(candidate.company) === normalize(existing.company)
      ) {
        return duplicateResult("EXACT", existing, ["company", "employerPostingId"], candidate);
      }

      const sameCompanyRole =
        hasValue(candidate.company) &&
        hasValue(candidate.roleTitle) &&
        normalize(candidate.company) === normalize(existing.company) &&
        normalize(candidate.roleTitle) === normalize(existing.roleTitle);
      if (!sameCompanyRole) continue;

      const locationComparable = hasValue(candidate.location) && hasValue(existing.location);
      const periodComparable = hasValue(candidate.internshipPeriod) && hasValue(existing.internshipPeriod);
      const sameLocation = locationComparable && normalize(candidate.location) === normalize(existing.location);
      const samePeriod = periodComparable && normalize(candidate.internshipPeriod) === normalize(existing.internshipPeriod);

      if (sameLocation && samePeriod) {
        return duplicateResult("EXACT", existing, ["company", "roleTitle", "location", "internshipPeriod"], candidate);
      }
      if (!locationComparable || !periodComparable) {
        return duplicateResult("POSSIBLE", existing, ["company", "roleTitle"], candidate);
      }
    }

    return { classification: "NONE", opportunityId: null, matchedBy: [], changedFields: [] };
  }

  async addOpportunity(input, { allowPossibleDuplicate = false } = {}) {
    return this.#enqueue(async () => {
      const records = await this.readRecords();
      const duplicate = await this.checkDuplicate(input, records);
      if (duplicate.classification === "EXACT") throw new DuplicateOpportunityError(duplicate);
      if (duplicate.classification === "POSSIBLE" && !allowPossibleDuplicate) {
        throw new AmbiguousDuplicateError(duplicate);
      }

      const now = toIsoDate(this.clock());
      const record = normalizeRecord({
        ...input,
        opportunityId: input.opportunityId || this.idFactory(),
        recordVersion: 1,
        dateAdded: input.dateAdded || now,
        dateDiscovered: input.dateDiscovered || now,
        lastUpdated: input.lastUpdated || now,
        postingStatus: input.postingStatus || "UNCERTAIN",
        applicationStatus: input.applicationStatus || "NOT STARTED",
        nextActionOwner: input.nextActionOwner || "AGENT",
        unresolvedIssueOwner: input.unresolvedIssue ? input.unresolvedIssueOwner || "AGENT" : "",
      });
      assertRequiredRecord(record);
      await this.#writeRecords([...records, record]);
      const verification = await this.verifyOpportunity(record.opportunityId, record);
      if (!verification.success) throw new Error(`Spreadsheet add verification failed for ${record.opportunityId}.`);
      return { record, duplicate, verification };
    });
  }

  async updateOpportunity(opportunityId, changes, { actor = "AGENT", expectedVersion } = {}) {
    return this.#enqueue(async () => {
      const records = await this.readRecords();
      const index = records.findIndex((record) => record.opportunityId === opportunityId);
      if (index < 0) throw new Error(`Opportunity ${opportunityId} was not found.`);
      const prior = records[index];
      if (expectedVersion !== undefined && Number(expectedVersion) !== Number(prior.recordVersion)) {
        throw new SpreadsheetConflictError(
          `Opportunity ${opportunityId} expected version ${expectedVersion}, but current version is ${prior.recordVersion}.`,
        );
      }

      const approvedChanges = enforceOwnership(prior, changes, actor);
      const changedFields = Object.keys(approvedChanges).filter(
        (key) => normalizeComparable(prior[key]) !== normalizeComparable(approvedChanges[key]),
      );
      if (changedFields.length === 0) {
        return {
          prior,
          record: prior,
          changedFields: [],
          materialChange: false,
          verification: { success: true, opportunityId, matchedFields: [] },
        };
      }

      const record = normalizeRecord({
        ...prior,
        ...approvedChanges,
        opportunityId,
        dateAdded: prior.dateAdded,
        dateDiscovered: prior.dateDiscovered,
        recordVersion: Number(prior.recordVersion) + 1,
        lastUpdated: toIsoDate(this.clock()),
      });
      records[index] = record;
      await this.#writeRecords(records);
      const verification = await this.verifyOpportunity(opportunityId, record);
      if (!verification.success) throw new Error(`Spreadsheet update verification failed for ${opportunityId}.`);
      return {
        prior,
        record,
        changedFields,
        materialChange: changedFields.some((field) => MATERIAL_FIELDS.has(field)),
        verification,
      };
    });
  }

  async verifyOpportunity(opportunityId, expected = {}) {
    const record = await this.getOpportunity(opportunityId);
    if (!record) return { success: false, opportunityId, missing: true, mismatches: [] };
    const mismatches = Object.entries(expected)
      .filter(([key]) => SPREADSHEET_COLUMNS.some((column) => column.key === key))
      .filter(([key, value]) => normalizeComparable(record[key]) !== normalizeComparable(value))
      .map(([key, expectedValue]) => ({ key, expected: expectedValue, observed: record[key] }));
    return {
      success: mismatches.length === 0,
      opportunityId,
      matchedFields: Object.keys(expected).filter((key) => !mismatches.some((item) => item.key === key)),
      mismatches,
    };
  }

  #enqueue(operation) {
    const queued = this.#writeQueue.then(operation, operation);
    this.#writeQueue = queued.catch(() => undefined);
    return queued;
  }

  async #writeRecords(records) {
    const { SpreadsheetFile, Workbook } = await loadArtifactTool({ modulePath: this.artifactToolModulePath });
    const workbook = Workbook.create();
    const sheet = workbook.worksheets.add(SHEET_NAME);
    sheet.showGridLines = false;
    sheet.freezePanes.freezeRows(1);

    const headers = SPREADSHEET_COLUMNS.map((column) => column.header);
    const matrix = [headers, ...records.map(recordToRow)];
    const lastColumn = columnLetter(SPREADSHEET_COLUMNS.length);
    const range = sheet.getRange(`A1:${lastColumn}${matrix.length}`);
    range.values = matrix;
    range.format.wrapText = true;
    range.format.verticalAlignment = "top";
    range.format.borders = { preset: "inside", style: "thin", color: "#D9E2E8" };

    const headerRange = sheet.getRange(`A1:${lastColumn}1`);
    headerRange.format.fill = "#153B4E";
    headerRange.format.font = { bold: true, color: "#FFFFFF" };
    headerRange.format.rowHeight = 30;
    headerRange.format.verticalAlignment = "center";

    SPREADSHEET_COLUMNS.forEach((column, index) => {
      const columnRange = sheet.getRange(`${columnLetter(index + 1)}1:${columnLetter(index + 1)}${Math.max(matrix.length, 2)}`);
      columnRange.format.columnWidth = column.width;
      if (column.date) columnRange.setNumberFormat("yyyy-mm-dd");
    });

    const postingStatusColumn = columnLetter(columnIndex("postingStatus"));
    sheet.getRange(`${postingStatusColumn}2:${postingStatusColumn}1000`).dataValidation = {
      rule: { type: "list", values: POSTING_STATUSES },
    };
    const applicationStatusColumn = columnLetter(columnIndex("applicationStatus"));
    sheet.getRange(`${applicationStatusColumn}2:${applicationStatusColumn}1000`).dataValidation = {
      rule: { type: "list", values: APPLICATION_STATUSES },
    };

    if (records.length > 0) {
      const table = sheet.tables.add(`A1:${lastColumn}${records.length + 1}`, true, TABLE_NAME);
      table.style = "TableStyleMedium2";
      table.showFilterButton = true;
      table.showBandedRows = true;
    }

    const xlsx = await SpreadsheetFile.exportXlsx(workbook);
    const temporaryPath = path.join(
      path.dirname(this.filePath),
      `.${path.basename(this.filePath)}.${this.idFactory()}.tmp.xlsx`,
    );
    try {
      await xlsx.save(temporaryPath);
      await replaceFileRecoverably(temporaryPath, this.filePath, this.idFactory());
    } finally {
      await rm(temporaryPath, { force: true });
      await rm(`${temporaryPath}.inspect.ndjson`, { force: true });
    }
  }
}

function validateAndMapHeaders(headerRow) {
  const observed = headerRow.map((value) => String(value ?? "").trim());
  const known = new Set(SPREADSHEET_COLUMNS.map((column) => column.header));
  const required = ["Opportunity ID", "Company", "Role title", "Posting URL"];
  if (observed.some((header) => header && !known.has(header)) || required.some((header) => !observed.includes(header))) {
    throw new Error("Spreadsheet schema is incompatible with the current Internship collection specification.");
  }
  return new Map(observed.map((header, index) => [header, index]));
}

function isRecordRow(row) {
  return hasValue(row?.[0]);
}

function rowToRecord(row, headerMap) {
  const record = {};
  SPREADSHEET_COLUMNS.forEach((column) => {
    const index = headerMap.get(column.header);
    const value = row[index];
    record[column.key] = column.date ? fromDateCell(value) : fromSafeCell(value);
  });
  record.recordVersion = Number(record.recordVersion || 0);
  return record;
}

function recordToRow(record) {
  return SPREADSHEET_COLUMNS.map((column) => {
    const value = record[column.key];
    if (column.date) return toDateCell(value);
    if (column.key === "recordVersion") return Number(value || 0);
    return toSafeCell(value);
  });
}

function normalizeRecord(input) {
  const result = {};
  SPREADSHEET_COLUMNS.forEach(({ key, date }) => {
    const value = input[key];
    result[key] = date ? normalizeDate(value) : value ?? "";
  });
  result.recordVersion = Number(input.recordVersion || 0);
  result.postingStatus = String(result.postingStatus || "UNCERTAIN").toUpperCase();
  if (!POSTING_STATUSES.includes(result.postingStatus)) {
    throw new TypeError(`Invalid posting status: ${result.postingStatus}.`);
  }
  result.applicationStatus = String(result.applicationStatus || "NOT STARTED").toUpperCase();
  return result;
}

function assertRequiredRecord(record) {
  for (const key of ["opportunityId", "company", "roleTitle", "postingUrl"]) {
    if (!hasValue(record[key])) throw new TypeError(`${key} is required for a spreadsheet opportunity.`);
  }
}

function enforceOwnership(prior, changes, actor) {
  const normalizedActor = String(actor).toUpperCase();
  if (!new Set(["AGENT", "STUDENT"]).has(normalizedActor)) {
    throw new TypeError(`Unknown spreadsheet actor: ${actor}.`);
  }
  const approved = {};
  for (const [key, value] of Object.entries(changes)) {
    if (!SPREADSHEET_COLUMNS.some((column) => column.key === key)) continue;
    if (AGENT_IMMUTABLE_FIELDS.has(key)) {
      if (normalizeComparable(value) !== normalizeComparable(prior[key])) {
        throw new SpreadsheetConflictError(`${key} is immutable after the opportunity is added.`);
      }
      continue;
    }
    if (normalizedActor === "AGENT" && STUDENT_OWNED_FIELDS.has(key)) {
      if (normalizeComparable(value) !== normalizeComparable(prior[key])) {
        throw new SpreadsheetConflictError(`The agent may not overwrite student-owned field ${key}.`);
      }
      continue;
    }
    if (
      normalizedActor === "AGENT" &&
      key === "nextAction" &&
      String(prior.nextActionOwner).toUpperCase() === "STUDENT" &&
      normalizeComparable(value) !== normalizeComparable(prior.nextAction)
    ) {
      throw new SpreadsheetConflictError("The agent may not overwrite a student-owned next action.");
    }
    if (
      normalizedActor === "AGENT" &&
      key === "unresolvedIssue" &&
      String(prior.unresolvedIssueOwner).toUpperCase() === "STUDENT" &&
      normalizeComparable(value) !== normalizeComparable(prior.unresolvedIssue)
    ) {
      throw new SpreadsheetConflictError("The agent may not overwrite a student-owned unresolved issue.");
    }
    approved[key] = value;
  }
  if (normalizedActor === "STUDENT") {
    if ("nextAction" in approved) approved.nextActionOwner = "STUDENT";
    if ("unresolvedIssue" in approved) approved.unresolvedIssueOwner = "STUDENT";
  }
  return approved;
}

function duplicateResult(classification, existing, matchedBy, candidate) {
  const changedFields = [...MATERIAL_FIELDS].filter(
    (field) => hasValue(candidate[field]) && normalizeComparable(candidate[field]) !== normalizeComparable(existing[field]),
  );
  return { classification, opportunityId: existing.opportunityId, matchedBy, changedFields };
}

export function canonicalizePostingUrl(value) {
  if (!hasValue(value)) return "";
  try {
    const url = new URL(String(value).trim());
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      if (/^(utm_|ref$|referrer$|source$|campaign$|tracking)/i.test(key)) url.searchParams.delete(key);
    }
    url.hostname = url.hostname.toLowerCase();
    url.pathname = url.pathname.replace(/\/+$/, "") || "/";
    url.searchParams.sort();
    return url.toString();
  } catch {
    return normalize(value);
  }
}

async function replaceFileRecoverably(temporaryPath, destinationPath, id) {
  const backupPath = `${destinationPath}.${id}.backup`;
  const destinationExists = await exists(destinationPath);
  if (!destinationExists) {
    await rename(temporaryPath, destinationPath);
    return;
  }

  await copyFile(destinationPath, backupPath);
  try {
    await rm(destinationPath);
    await rename(temporaryPath, destinationPath);
    await rm(backupPath, { force: true });
  } catch (error) {
    if (await exists(backupPath)) await copyFile(backupPath, destinationPath);
    await rm(temporaryPath, { force: true });
    await rm(backupPath, { force: true });
    throw error;
  }
}

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function normalize(value) {
  return String(value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeComparable(value) {
  if (value instanceof Date) return toIsoDate(value);
  return normalize(value);
}

function hasValue(value) {
  return value !== null && value !== undefined && String(value).trim() !== "";
}

function normalizeDate(value) {
  if (!hasValue(value)) return "";
  if (value instanceof Date) return toIsoDate(value);
  const text = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const parsed = new Date(text);
  if (Number.isNaN(parsed.valueOf())) return text;
  return toIsoDate(parsed);
}

function toIsoDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.valueOf())) throw new TypeError(`Invalid date: ${value}.`);
  return date.toISOString().slice(0, 10);
}

function toDateCell(value) {
  if (!hasValue(value)) return null;
  const normalized = normalizeDate(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return toSafeCell(normalized);
  return new Date(`${normalized}T12:00:00.000Z`);
}

function fromDateCell(value) {
  if (!hasValue(value)) return "";
  if (value instanceof Date) return toIsoDate(value);
  if (typeof value === "number") {
    const excelEpoch = Date.UTC(1899, 11, 30);
    return toIsoDate(new Date(excelEpoch + value * 86_400_000));
  }
  return normalizeDate(fromSafeCell(value));
}

function toSafeCell(value) {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
}

function fromSafeCell(value) {
  const text = value === null || value === undefined ? "" : String(value);
  return /^'[=+\-@]/.test(text) ? text.slice(1) : text;
}

function columnIndex(key) {
  return SPREADSHEET_COLUMNS.findIndex((column) => column.key === key) + 1;
}

function columnLetter(index) {
  let value = index;
  let result = "";
  while (value > 0) {
    value -= 1;
    result = String.fromCharCode(65 + (value % 26)) + result;
    value = Math.floor(value / 26);
  }
  return result;
}
