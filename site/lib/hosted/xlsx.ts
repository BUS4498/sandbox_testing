import { strToU8, zipSync } from "fflate";
import type { OpportunityRecord, StudentSetup } from "./store";
import { currentPreliminaryScore } from "./opportunity-sort.js";
import { assessmentMatchesSetup, cleanNextAction, sourceCheckPending } from "./opportunity-state.js";

const HEADERS = ["Opportunity ID", "Date added", "Date discovered", "Last updated", "Last verified", "Company", "Role title", "Location", "Work arrangement", "Internship period", "Deadline", "Source", "Posting URL", "Application URL", "Posting status", "Fit assessment", "Preliminary fit score", "Fit score status", "Fit score model", "Fit score rubric", "Fit score time", "Agent decision", "Decision rationale", "Application status", "Next action", "Next-action date", "Unresolved issue", "Last agent review", "Student notes"];

function escapeXml(value: unknown): string {
  return String(value ?? "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function columnName(index: number): string {
  let name = "";
  for (let number = index + 1; number > 0; number = Math.floor((number - 1) / 26)) name = String.fromCharCode(65 + ((number - 1) % 26)) + name;
  return name;
}

function rowXml(values: unknown[], rowNumber: number): string {
  const cells = values.map((value, column) => {
    const cell = `${columnName(column)}${rowNumber}`;
    if (typeof value === "number" && Number.isFinite(value)) return `<c r="${cell}" t="n"><v>${value}</v></c>`;
    return `<c r="${cell}" t="inlineStr"${rowNumber === 1 ? ' s="1"' : ""}><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
  }).join("");
  return `<row r="${rowNumber}">${cells}</row>`;
}

export function createCollectionWorkbook(records: OpportunityRecord[], setup: StudentSetup): Uint8Array {
  const rows = records.map((record) => {
    const current = assessmentMatchesSetup(record, setup);
    const score = currentPreliminaryScore(record, setup.mode, setup.confirmedAt);
    const action = cleanNextAction(record.nextAction);
    return [record.opportunityId, record.dateAdded, record.dateDiscovered, record.lastUpdated, record.lastVerified, record.company, record.roleTitle, record.location, record.workArrangement, record.internshipPeriod, record.deadline, record.source, record.postingUrl, record.applicationUrl, record.postingStatus, current ? record.fitAssessment : "NEEDS REASSESSMENT — assessment from an earlier student setup is not current", score ?? "", current ? record.fitScore?.status ?? "UNAVAILABLE" : "STALE", current ? record.fitScore?.model ?? "" : "", current ? record.fitScore?.rubricVersion ?? "" : "", score === null ? "" : record.fitScore?.scoredAt ?? "", current ? record.agentDecision : "NEEDS REASSESSMENT", current ? record.decisionRationale : "Prior rationale hidden until reassessment for the current setup", record.applicationStatus, current ? sourceCheckPending(record) ? `Agent source check: ${action}` : action : sourceCheckPending(record) ? "Agent source check, then reassess for the current resume" : "Reassess for the current resume", record.nextActionDate, current ? record.unresolvedIssue : "Earlier-profile issue hidden until reassessment", record.lastAgentReview, current ? record.studentNotes : ""];
  });
  const lastCell = `${columnName(HEADERS.length - 1)}${rows.length + 1}`;
  const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:${lastCell}"/><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${HEADERS.map((_, i) => `<col min="${i + 1}" max="${i + 1}" width="${[0,12,13].includes(i) ? 22 : [6,7,17,19].includes(i) ? 28 : 20}" customWidth="1"/>`).join("")}</cols><sheetData>${rowXml(HEADERS, 1)}${rows.map((row, i) => rowXml(row, i + 2)).join("")}</sheetData><autoFilter ref="A1:${lastCell}"/></worksheet>`;
  const now = new Date().toISOString();
  const files: Record<string, Uint8Array> = {
    "[Content_Types].xml": strToU8(`<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>`),
    "_rels/.rels": strToU8(`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`),
    "docProps/core.xml": strToU8(`<?xml version="1.0" encoding="UTF-8"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dcterms="http://purl.org/dc/terms/"><dcterms:created xsi:type="dcterms:W3CDTF" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">${now}</dcterms:created></cp:coreProperties>`),
    "xl/workbook.xml": strToU8(`<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Opportunities" sheetId="1" r:id="rId1"/></sheets></workbook>`),
    "xl/_rels/workbook.xml.rels": strToU8(`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`),
    "xl/styles.xml": strToU8(`<?xml version="1.0" encoding="UTF-8"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font/><font><b/><color rgb="FFFFFFFF"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF0E716C"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="1" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`),
    "xl/worksheets/sheet1.xml": strToU8(sheet),
  };
  return zipSync(files, { level: 6 });
}
