const DECISIONS = new Set(["PRIORITIZE", "MONITOR", "PREPARE", "FOLLOW UP", "ARCHIVE", "ESCALATE TO USER"]);
const FIT_ASSESSMENTS = new Set(["STRONG", "MODERATE", "WEAK", "INSUFFICIENT INFORMATION"]);
const DISPOSITIONS = new Set(["NEW", "MATERIALLY_CHANGED"]);
const POSTING_STATUSES = new Set(["ACTIVE", "CLOSED", "UNCERTAIN"]);
const RESPONSE_TYPES = new Set(["NONE", "CONFIRMATION", "TEXT", "CHOICE"]);
const PREP_STATUSES = new Set(["NOT_REQUESTED", "PREPARED", "NEEDS_INFORMATION"]);
const TEMPLATE_TYPES = new Set(["RESUME_TAILORING_CHECKLIST", "COVER_LETTER_OUTLINE", "APPLICATION_QUESTION_WORKSHEET"]);
const FORBIDDEN_KEY = /(password|api[_-]?key|access[_-]?token|refresh[_-]?token|secret|credential|raw[_-]?(html|page))/i;

const RESULT_CONTRACT_INSTRUCTION = `
Return the final business result as one JSON object only. Do not use Markdown fences or include prose before or after the JSON.

Use this compact contract:
{
  "schemaVersion": 1,
  "runSummary": {
    "searchesPerformed": 0,
    "candidatesDiscovered": 0,
    "duplicatesOrInvalid": 0,
    "candidatesRanked": 0,
    "selectionShortfallReason": "Required when fewer than three opportunities are selected"
  },
  "selectedOpportunities": [
    {
      "updateDisposition": "NEW or MATERIALLY_CHANGED",
      "existingOpportunityId": null,
      "opportunity": {
        "opportunityId": null,
        "company": "...",
        "roleTitle": "...",
        "location": "...",
        "workArrangement": "...",
        "internshipPeriod": "...",
        "deadline": "YYYY-MM-DD or Unknown",
        "source": "...",
        "postingUrl": "https://...",
        "applicationUrl": "https://... or empty when unavailable",
        "employerPostingId": "...",
        "postingStatus": "ACTIVE, CLOSED, or UNCERTAIN",
        "dateDiscovered": "YYYY-MM-DD",
        "lastVerified": "YYYY-MM-DD"
      },
      "fitAssessment": "STRONG, MODERATE, WEAK, or INSUFFICIENT INFORMATION",
      "agentDecision": "PRIORITIZE, MONITOR, PREPARE, FOLLOW UP, ARCHIVE, or ESCALATE TO USER",
      "decisionRationale": "concise evidence-based rationale",
      "selectionEvidence": ["..."],
      "fitEvidence": {
        "requiredMatches": ["..."],
        "preferredMatches": ["..."],
        "gaps": ["..."],
        "unknowns": ["..."],
        "preferenceAlignment": ["..."]
      },
      "whatChanged": ["..."],
      "nextAction": "...",
      "nextActionRequest": {
        "prompt": "exact information or confirmation requested from the student",
        "responseType": "NONE, CONFIRMATION, TEXT, or CHOICE",
        "options": ["..."],
        "whatHappensNext": "what the immediate targeted update will do after the response is saved"
      },
      "nextActionDate": "YYYY-MM-DD or Unknown",
      "unresolvedIssue": "",
      "attentionRequired": false,
      "studentInputResolution": null,
      "applicationPrep": {
        "status": "NOT_REQUESTED, PREPARED, or NEEDS_INFORMATION",
        "templates": [],
        "nextStep": ""
      }
    }
  ],
  "unresolvedIssues": ["..."]
}`;

export const WORKFLOW_RESULT_INSTRUCTION = `${RESULT_CONTRACT_INSTRUCTION}

Discovery-mode rules: select three to five genuinely new or materially changed opportunities when at least three valid, sufficiently relevant candidates qualify. If fewer than three are selected, selectionShortfallReason is required and must identify the qualification, duplicate, hard-constraint, or external-search limitation. Never pad the result with weak opportunities. Preserve unknown values, include structured evidence rather than hidden reasoning, and never include credentials or full webpage content.`;

export const UPDATE_WORKFLOW_RESULT_INSTRUCTION = `${RESULT_CONTRACT_INSTRUCTION}

Targeted-update rules: perform no web search and set all four discovery counts to 0. Return exactly one MATERIALLY_CHANGED selection for the supplied existing opportunity, with its existingOpportunityId and studentInputResolution. selectionShortfallReason may be empty. Process no other opportunity. Preserve unknown values, include structured evidence rather than hidden reasoning, and never include credentials or full webpage content.`;

export class WorkflowResultValidationError extends Error {
  constructor(message, code = "INVALID_WORKFLOW_RESULT", options) {
    super(message, options);
    this.name = "WorkflowResultValidationError";
    this.code = code;
  }
}

export function parseAndValidateWorkflowResult(text, { observedSearches, mode = "DISCOVERY", targetOpportunityId } = {}) {
  if (typeof text !== "string" || text.trim() === "") {
    throw new WorkflowResultValidationError("The Codex turn did not provide a structured workflow result.", "MISSING_RESULT");
  }
  if (text.length > 200_000) {
    throw new WorkflowResultValidationError("The workflow result exceeded the local size limit.", "RESULT_TOO_LARGE");
  }

  let result;
  try {
    result = JSON.parse(text.trim().replace(/^\uFEFF/, ""));
  } catch (cause) {
    throw new WorkflowResultValidationError("The workflow result must be one valid JSON object.", "INVALID_JSON", { cause });
  }
  if (!isPlainObject(result)) throw new WorkflowResultValidationError("The workflow result must be a JSON object.");
  assertNoForbiddenKeys(result);
  if (result.schemaVersion !== 1) throw new WorkflowResultValidationError("Unsupported workflow-result schema version.");
  if (!isPlainObject(result.runSummary)) throw new WorkflowResultValidationError("runSummary is required.");
  if (!Array.isArray(result.selectedOpportunities)) throw new WorkflowResultValidationError("selectedOpportunities must be an array.");
  if (!Array.isArray(result.unresolvedIssues)) throw new WorkflowResultValidationError("unresolvedIssues must be an array.");

  const summary = {
    searchesPerformed: boundedInteger(result.runSummary.searchesPerformed, "searchesPerformed", 0, 3),
    candidatesDiscovered: boundedInteger(result.runSummary.candidatesDiscovered, "candidatesDiscovered", 0, 15),
    duplicatesOrInvalid: boundedInteger(result.runSummary.duplicatesOrInvalid, "duplicatesOrInvalid", 0, 15),
    candidatesRanked: boundedInteger(result.runSummary.candidatesRanked, "candidatesRanked", 0, 15),
    selectionShortfallReason: optionalString(result.runSummary.selectionShortfallReason, 1_000),
  };
  if (observedSearches !== undefined) {
    boundedInteger(observedSearches, "observedSearches", 0, 3);
    if (Number(observedSearches) !== summary.searchesPerformed) {
      throw new WorkflowResultValidationError(
        `The structured search count (${summary.searchesPerformed}) did not match observable web-search activity (${observedSearches}).`,
        "SEARCH_COUNT_MISMATCH",
      );
    }
  }
  const normalizedMode = String(mode).toUpperCase();
  if (!new Set(["DISCOVERY", "TARGETED_UPDATE"]).has(normalizedMode)) {
    throw new WorkflowResultValidationError("Unsupported workflow-result mode.");
  }
  if (result.selectedOpportunities.length > 5) {
    throw new WorkflowResultValidationError("No more than five opportunities may be selected for detailed processing.", "UPDATE_LIMIT_EXCEEDED");
  }
  if (normalizedMode === "DISCOVERY" && result.selectedOpportunities.length < 3 && !summary.selectionShortfallReason) {
    throw new WorkflowResultValidationError(
      "selectionShortfallReason is required when fewer than three opportunities are selected.",
      "SELECTION_SHORTFALL_REASON_REQUIRED",
    );
  }
  if (summary.candidatesRanked > summary.candidatesDiscovered) {
    throw new WorkflowResultValidationError("Candidates ranked cannot exceed candidates discovered.");
  }
  if (normalizedMode === "DISCOVERY" && result.selectedOpportunities.length > summary.candidatesRanked) {
    throw new WorkflowResultValidationError("Selected opportunities cannot exceed candidates ranked.");
  }

  if (normalizedMode === "TARGETED_UPDATE") {
    if ([summary.searchesPerformed, summary.candidatesDiscovered, summary.duplicatesOrInvalid, summary.candidatesRanked].some((value) => value !== 0)) {
      throw new WorkflowResultValidationError("A targeted update must report zero discovery activity.", "TARGETED_UPDATE_DISCOVERY_FORBIDDEN");
    }
    if (result.selectedOpportunities.length !== 1) {
      throw new WorkflowResultValidationError("A targeted update must process exactly one opportunity.", "TARGETED_UPDATE_SCOPE_INVALID");
    }
    const selected = result.selectedOpportunities[0];
    if (String(selected.updateDisposition).toUpperCase() !== "MATERIALLY_CHANGED") {
      throw new WorkflowResultValidationError("A targeted update must update an existing opportunity.", "TARGETED_UPDATE_DISPOSITION_INVALID");
    }
    if (targetOpportunityId && String(selected.existingOpportunityId) !== String(targetOpportunityId)) {
      throw new WorkflowResultValidationError("The targeted update returned a different opportunity.", "TARGETED_UPDATE_TARGET_MISMATCH");
    }
    if (!selected.studentInputResolution) {
      throw new WorkflowResultValidationError("A targeted update must resolve or narrow the submitted student response.", "TARGETED_UPDATE_RESOLUTION_REQUIRED");
    }
  }

  return {
    schemaVersion: 1,
    runSummary: summary,
    selectedOpportunities: result.selectedOpportunities.map(validateSelectedOpportunity),
    unresolvedIssues: validateStringArray(result.unresolvedIssues, "unresolvedIssues", 20),
  };
}

function validateSelectedOpportunity(value, index) {
  if (!isPlainObject(value)) throw new WorkflowResultValidationError(`selectedOpportunities[${index}] must be an object.`);
  const disposition = enumValue(value.updateDisposition, DISPOSITIONS, `selectedOpportunities[${index}].updateDisposition`);
  const opportunity = validateOpportunity(value.opportunity, index);
  const fitAssessment = enumValue(value.fitAssessment, FIT_ASSESSMENTS, `selectedOpportunities[${index}].fitAssessment`);
  const agentDecision = enumValue(value.agentDecision, DECISIONS, `selectedOpportunities[${index}].agentDecision`);
  if (disposition === "MATERIALLY_CHANGED" && !nonEmpty(value.existingOpportunityId)) {
    throw new WorkflowResultValidationError(`selectedOpportunities[${index}].existingOpportunityId is required for a material change.`);
  }
  if (disposition === "NEW" && opportunity.postingStatus === "CLOSED") {
    throw new WorkflowResultValidationError(`selectedOpportunities[${index}] cannot add a newly discovered closed posting.`);
  }

  return {
    updateDisposition: disposition,
    existingOpportunityId: optionalString(value.existingOpportunityId, 120),
    opportunity,
    fitAssessment,
    agentDecision,
    decisionRationale: requiredString(value.decisionRationale, `selectedOpportunities[${index}].decisionRationale`, 2_000),
    selectionEvidence: validateStringArray(value.selectionEvidence, `selectedOpportunities[${index}].selectionEvidence`, 20),
    fitEvidence: validateFitEvidence(value.fitEvidence, index),
    whatChanged: validateStringArray(value.whatChanged, `selectedOpportunities[${index}].whatChanged`, 20),
    nextAction: requiredString(value.nextAction, `selectedOpportunities[${index}].nextAction`, 1_000),
    nextActionRequest: validateNextActionRequest(value.nextActionRequest, index),
    nextActionDate: optionalString(value.nextActionDate, 80),
    unresolvedIssue: optionalString(value.unresolvedIssue, 1_000),
    attentionRequired: value.attentionRequired === true,
    studentInputResolution: validateStudentInputResolution(value.studentInputResolution, index),
    applicationPrep: validateApplicationPrep(value.applicationPrep, index),
  };
}

function validateOpportunity(value, index) {
  if (!isPlainObject(value)) throw new WorkflowResultValidationError(`selectedOpportunities[${index}].opportunity is required.`);
  const postingUrl = requiredString(value.postingUrl, `selectedOpportunities[${index}].opportunity.postingUrl`, 2_000);
  assertPublicHttpUrl(postingUrl, `selectedOpportunities[${index}].opportunity.postingUrl`);
  const applicationUrl = optionalString(value.applicationUrl, 2_000);
  if (applicationUrl) assertPublicHttpUrl(applicationUrl, `selectedOpportunities[${index}].opportunity.applicationUrl`);
  return {
    opportunityId: optionalString(value.opportunityId, 120),
    company: requiredString(value.company, `selectedOpportunities[${index}].opportunity.company`, 300),
    roleTitle: requiredString(value.roleTitle, `selectedOpportunities[${index}].opportunity.roleTitle`, 300),
    location: optionalString(value.location, 300),
    workArrangement: optionalString(value.workArrangement, 100),
    internshipPeriod: optionalString(value.internshipPeriod, 150),
    deadline: optionalString(value.deadline, 80),
    source: requiredString(value.source, `selectedOpportunities[${index}].opportunity.source`, 300),
    postingUrl,
    applicationUrl,
    employerPostingId: optionalString(value.employerPostingId, 200),
    postingStatus: enumValue(value.postingStatus, POSTING_STATUSES, `selectedOpportunities[${index}].opportunity.postingStatus`),
    dateDiscovered: optionalString(value.dateDiscovered, 80),
    lastVerified: optionalString(value.lastVerified, 80),
  };
}

function validateNextActionRequest(value, index) {
  if (value === null || value === undefined) {
    return { prompt: "", responseType: "NONE", options: [], whatHappensNext: "" };
  }
  if (!isPlainObject(value)) throw new WorkflowResultValidationError(`selectedOpportunities[${index}].nextActionRequest must be an object.`);
  const responseType = enumValue(value.responseType ?? "NONE", RESPONSE_TYPES, `selectedOpportunities[${index}].nextActionRequest.responseType`);
  const prompt = optionalString(value.prompt, 1_000);
  const whatHappensNext = optionalString(value.whatHappensNext, 1_000);
  const options = validateStringArray(value.options ?? [], `selectedOpportunities[${index}].nextActionRequest.options`, 10);
  if (responseType !== "NONE" && (!prompt || !whatHappensNext)) {
    throw new WorkflowResultValidationError(`selectedOpportunities[${index}].nextActionRequest requires a prompt and whatHappensNext.`);
  }
  if (responseType === "CHOICE" && options.length < 2) {
    throw new WorkflowResultValidationError(`selectedOpportunities[${index}].nextActionRequest.options requires at least two choices.`);
  }
  return { prompt, responseType, options, whatHappensNext };
}

function validateStudentInputResolution(value, index) {
  if (value === null || value === undefined) return null;
  if (!isPlainObject(value)) throw new WorkflowResultValidationError(`selectedOpportunities[${index}].studentInputResolution must be an object or null.`);
  return {
    responseId: requiredString(value.responseId, `selectedOpportunities[${index}].studentInputResolution.responseId`, 120),
    status: enumValue(value.status, new Set(["REVIEWED", "NEEDS_MORE_INFORMATION"]), `selectedOpportunities[${index}].studentInputResolution.status`),
    outcome: requiredString(value.outcome, `selectedOpportunities[${index}].studentInputResolution.outcome`, 1_000),
    nextStep: requiredString(value.nextStep, `selectedOpportunities[${index}].studentInputResolution.nextStep`, 1_000),
  };
}

function validateApplicationPrep(value, index) {
  if (value === null || value === undefined) return { status: "NOT_REQUESTED", templates: [], nextStep: "" };
  if (!isPlainObject(value)) throw new WorkflowResultValidationError(`selectedOpportunities[${index}].applicationPrep must be an object.`);
  const status = enumValue(value.status ?? "NOT_REQUESTED", PREP_STATUSES, `selectedOpportunities[${index}].applicationPrep.status`);
  if (!Array.isArray(value.templates) || value.templates.length > 3) {
    throw new WorkflowResultValidationError(`selectedOpportunities[${index}].applicationPrep.templates must contain no more than three templates.`);
  }
  const templates = value.templates.map((template, templateIndex) => {
    if (!isPlainObject(template)) throw new WorkflowResultValidationError(`applicationPrep.templates[${templateIndex}] must be an object.`);
    return {
      type: enumValue(template.type, TEMPLATE_TYPES, `applicationPrep.templates[${templateIndex}].type`),
      title: requiredString(template.title, `applicationPrep.templates[${templateIndex}].title`, 300),
      markdown: requiredString(template.markdown, `applicationPrep.templates[${templateIndex}].markdown`, 20_000),
      placeholders: validateStringArray(template.placeholders ?? [], `applicationPrep.templates[${templateIndex}].placeholders`, 30),
    };
  });
  if (status === "PREPARED" && templates.length === 0) {
    throw new WorkflowResultValidationError(`A PREPARED applicationPrep result requires at least one template.`);
  }
  if (status !== "PREPARED" && templates.length > 0) {
    throw new WorkflowResultValidationError(`Only PREPARED applicationPrep results may include templates.`);
  }
  return { status, templates, nextStep: optionalString(value.nextStep, 1_000) };
}

function validateFitEvidence(value, index) {
  if (!isPlainObject(value)) throw new WorkflowResultValidationError(`selectedOpportunities[${index}].fitEvidence is required.`);
  const output = {};
  for (const key of ["requiredMatches", "preferredMatches", "gaps", "unknowns", "preferenceAlignment"]) {
    output[key] = validateStringArray(value[key], `selectedOpportunities[${index}].fitEvidence.${key}`, 30);
  }
  return output;
}

function assertPublicHttpUrl(value, field) {
  let url;
  try { url = new URL(value); } catch { throw new WorkflowResultValidationError(`${field} must be a valid URL.`); }
  if (!new Set(["http:", "https:"]).has(url.protocol)) {
    throw new WorkflowResultValidationError(`${field} must use HTTP or HTTPS.`);
  }
  const host = url.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host === "::1" ||
    host.endsWith(".local") ||
    /^(0|10|127|169\.254|192\.168)\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host)
  ) {
    throw new WorkflowResultValidationError(`${field} must identify a public posting source.`);
  }
}

function assertNoForbiddenKeys(value, trail = "result") {
  if (Array.isArray(value)) return value.forEach((item, index) => assertNoForbiddenKeys(item, `${trail}[${index}]`));
  if (!isPlainObject(value)) return;
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_KEY.test(key)) throw new WorkflowResultValidationError(`Forbidden sensitive or raw-content field: ${trail}.${key}.`);
    assertNoForbiddenKeys(child, `${trail}.${key}`);
  }
}

function validateStringArray(value, field, maximumItems) {
  if (!Array.isArray(value) || value.length > maximumItems) {
    throw new WorkflowResultValidationError(`${field} must be an array with no more than ${maximumItems} items.`);
  }
  return value.map((item, index) => requiredString(item, `${field}[${index}]`, 1_000));
}

function boundedInteger(value, field, minimum, maximum) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < minimum || number > maximum) {
    throw new WorkflowResultValidationError(`${field} must be an integer from ${minimum} through ${maximum}.`);
  }
  return number;
}

function enumValue(value, allowed, field) {
  const normalized = String(value ?? "").trim().toUpperCase();
  if (!allowed.has(normalized)) throw new WorkflowResultValidationError(`${field} has an unsupported value.`);
  return normalized;
}

function requiredString(value, field, maximumLength) {
  const text = optionalString(value, maximumLength);
  if (!text) throw new WorkflowResultValidationError(`${field} is required.`);
  return text;
}

function optionalString(value, maximumLength) {
  if (value === null || value === undefined) return "";
  const text = String(value).trim();
  if (text.length > maximumLength) throw new WorkflowResultValidationError(`A text field exceeded ${maximumLength} characters.`);
  return text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
}

function nonEmpty(value) {
  return value !== null && value !== undefined && String(value).trim() !== "";
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
