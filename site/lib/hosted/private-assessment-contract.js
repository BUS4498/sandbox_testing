import { finalAssessmentIssues } from "./assessment-issues.js";
import { WorkflowResultValidationError, parseAndValidateWorkflowResult } from "./specs/workflow-result-contract.js";

const STRING_ARRAY = { type: "array", items: { type: "string" } };
const FIT_EVIDENCE = {
  type: "object",
  properties: {
    requiredMatches: STRING_ARRAY,
    preferredMatches: STRING_ARRAY,
    gaps: STRING_ARRAY,
    unknowns: STRING_ARRAY,
    preferenceAlignment: STRING_ARRAY,
  },
  required: ["requiredMatches", "preferredMatches", "gaps", "unknowns", "preferenceAlignment"],
  additionalProperties: false,
};
const NEXT_ACTION_REQUEST = {
  type: "object",
  properties: {
    prompt: { type: "string" },
    responseType: { type: "string", enum: ["NONE", "CONFIRMATION", "TEXT", "CHOICE"] },
    options: STRING_ARRAY,
    whatHappensNext: { type: "string" },
  },
  required: ["prompt", "responseType", "options", "whatHappensNext"],
  additionalProperties: false,
};

// Private review returns only fields it is allowed to change. The verified
// discovery result remains authoritative for posting facts, identity and counts.
export const PRIVATE_ASSESSMENT_JSON_SCHEMA = {
  type: "object",
  properties: {
    assessments: {
      type: "array",
      items: {
        type: "object",
        properties: {
          selectionIndex: { type: "integer" },
          fitAssessment: { type: "string", enum: ["STRONG", "MODERATE", "WEAK", "INSUFFICIENT INFORMATION"] },
          agentDecision: { type: "string", enum: ["PRIORITIZE", "MONITOR", "PREPARE", "FOLLOW UP", "ARCHIVE", "ESCALATE TO USER"] },
          decisionRationale: { type: "string" },
          fitEvidence: FIT_EVIDENCE,
          nextAction: { type: "string" },
          nextActionRequest: NEXT_ACTION_REQUEST,
          nextActionDate: { type: "string" },
          unresolvedIssue: { type: "string" },
          attentionRequired: { type: "boolean" },
        },
        required: ["selectionIndex", "fitAssessment", "agentDecision", "decisionRationale", "fitEvidence", "nextAction", "nextActionRequest", "nextActionDate", "unresolvedIssue", "attentionRequired"],
        additionalProperties: false,
      },
    },
    unresolvedIssues: STRING_ARRAY,
  },
  required: ["assessments", "unresolvedIssues"],
  additionalProperties: false,
};

export function mergePrivateAssessment(text, discovery, observedSearches) {
  if (typeof text !== "string" || !text.trim() || text.length > 200_000) {
    throw new WorkflowResultValidationError("Private assessment was empty or exceeded the size limit.");
  }
  let output;
  try { output = JSON.parse(text.trim().replace(/^\uFEFF/, "")); }
  catch { throw new WorkflowResultValidationError("Private assessment was not valid JSON."); }
  if (!output || typeof output !== "object" || Array.isArray(output) || !Array.isArray(output.assessments) || !Array.isArray(output.unresolvedIssues)) {
    throw new WorkflowResultValidationError("Private assessment must contain assessments and unresolvedIssues arrays.");
  }
  if (Object.keys(output).some((key) => !["assessments", "unresolvedIssues"].includes(key))) {
    throw new WorkflowResultValidationError("Private assessment returned fields outside its permitted scope.");
  }
  const selected = discovery.selectedOpportunities;
  if (output.assessments.length !== selected.length) {
    throw new WorkflowResultValidationError(`Private assessment covered ${output.assessments.length} of ${selected.length} selected opportunities.`);
  }
  const byIndex = new Map();
  const allowed = new Set(["selectionIndex", "fitAssessment", "agentDecision", "decisionRationale", "fitEvidence", "nextAction", "nextActionRequest", "nextActionDate", "unresolvedIssue", "attentionRequired"]);
  for (const item of output.assessments) {
    if (!item || typeof item !== "object" || Array.isArray(item) || Object.keys(item).some((key) => !allowed.has(key)) || [...allowed].some((key) => !(key in item))) {
      throw new WorkflowResultValidationError("Private assessment contained an invalid or out-of-scope opportunity item.");
    }
    if (!Number.isInteger(item.selectionIndex) || item.selectionIndex < 0 || item.selectionIndex >= selected.length || byIndex.has(item.selectionIndex)) {
      throw new WorkflowResultValidationError("Private assessment contained a missing, repeated, or invalid selection index.");
    }
    byIndex.set(item.selectionIndex, item);
  }
  const merged = selected.map((source, index) => {
    const assessment = Object.fromEntries(Object.entries(byIndex.get(index)).filter(([key]) => key !== "selectionIndex"));
    return { ...source, ...assessment };
  });
  const result = parseAndValidateWorkflowResult(JSON.stringify({
    schemaVersion: discovery.schemaVersion,
    runSummary: discovery.runSummary,
    selectedOpportunities: merged,
    unresolvedIssues: finalAssessmentIssues(discovery.unresolvedIssues, output.unresolvedIssues),
  }), { observedSearches, mode: "DISCOVERY" });
  if (result.selectedOpportunities.some((item) => item.applicationPrep.status !== "NOT_REQUESTED")) {
    throw new WorkflowResultValidationError("Private assessment cannot prepare application materials.");
  }
  return result;
}
