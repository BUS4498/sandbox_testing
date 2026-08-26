import { randomUUID } from "node:crypto";

const RESPONSE_TYPES = new Set(["CONFIRM_COMPLETED", "PROVIDE_INFORMATION", "NOT_INTERESTED", "REQUEST_APPLICATION_MATERIALS"]);
const TEMPLATE_TYPES = new Set(["RESUME_TAILORING_CHECKLIST", "COVER_LETTER_OUTLINE", "APPLICATION_QUESTION_WORKSHEET"]);

export class StudentResponseService {
  constructor({ spreadsheetTracker, memoryStore, clock = () => new Date(), idFactory = randomUUID }) {
    if (!spreadsheetTracker || !memoryStore) throw new TypeError("StudentResponseService requires spreadsheet and memory helpers.");
    this.spreadsheetTracker = spreadsheetTracker;
    this.memoryStore = memoryStore;
    this.clock = clock;
    this.idFactory = idFactory;
  }

  async submit({ opportunityId, type, text = "", templateTypes = [] }) {
    const normalizedType = String(type ?? "").trim().toUpperCase();
    if (!opportunityId) throw validationError("Choose an opportunity before saving a response.");
    if (!RESPONSE_TYPES.has(normalizedType)) throw validationError("Choose a supported response type.");
    const record = await this.spreadsheetTracker.getOpportunity(opportunityId);
    if (!record) throw notFoundError("The selected opportunity is no longer in the local collection.");
    const responseText = cleanText(text);
    if (normalizedType === "PROVIDE_INFORMATION" && !responseText) throw validationError("Enter the information the agent should review.");
    const requestedTemplates = normalizeTemplateTypes(templateTypes);
    if (normalizedType === "REQUEST_APPLICATION_MATERIALS" && requestedTemplates.length === 0) {
      throw validationError("Choose at least one application-material template.");
    }

    const responseId = this.idFactory();
    const submittedAt = this.clock().toISOString();
    const noteText = responseText || defaultNote(normalizedType, requestedTemplates);
    const priorNotes = String(record.studentNotes ?? "").trim();
    const studentNotes = [priorNotes, `${submittedAt.slice(0, 10)} [${normalizedType}] ${noteText}`].filter(Boolean).join("\n").slice(-8_000);
    const changes = { studentNotes };
    if (normalizedType === "NOT_INTERESTED") changes.applicationStatus = "WITHDRAWN";
    const spreadsheetResult = await this.spreadsheetTracker.updateOpportunity(opportunityId, changes, {
      actor: "STUDENT",
      expectedVersion: record.recordVersion,
    });
    const nextStep = normalizedType === "REQUEST_APPLICATION_MATERIALS"
      ? "Your request is saved. The agent will now run a targeted update and prepare the requested review-only templates; it cannot submit an application."
      : "Your response is saved. The agent will now run a targeted update for this opportunity and advance its next action when possible.";
    const studentInput = {
      responseId,
      opportunityId,
      type: normalizedType,
      text: responseText,
      templateTypes: requestedTemplates,
      submittedAt,
      status: "READY_FOR_UPDATE",
      nextStep,
    };
    await this.memoryStore.upsertOpportunityState(opportunityId, { studentInput });
    await this.memoryStore.appendAction({
      opportunityId,
      actionType: "STUDENT_RESPONSE_RECORDED",
      responseId,
      responseType: normalizedType,
      outcome: "SUCCESS",
      spreadsheetRecordVersion: spreadsheetResult.record.recordVersion,
    });
    await this.memoryStore.appendObservation({
      opportunityId,
      observationType: normalizedType === "REQUEST_APPLICATION_MATERIALS" ? "APPLICATION_PREP_REQUESTED" : "STUDENT_INPUT_READY_FOR_REVIEW",
      responseId,
      responseType: normalizedType,
      requestedTemplateTypes: requestedTemplates,
    });
    await this.memoryStore.appendEvaluation({
      opportunityId,
      expectedOutcome: "Save the student's response in student-owned notes and make it available for an immediate targeted update.",
      observedOutcome: "The spreadsheet update passed read-back verification and the response is ready for the targeted update.",
      outcome: "SUCCESS",
      unresolvedIssue: null,
      recommendedCorrectiveAction: nextStep,
    });
    return { responseId, opportunityId, status: "READY_FOR_UPDATE", submittedAt, nextStep };
  }

  async markUpdateStarted({ opportunityId, responseId, runId }) {
    const state = await this.memoryStore.getState();
    const prior = state.opportunities?.[opportunityId]?.studentInput;
    if (!prior || prior.responseId !== responseId) throw notFoundError("The saved response is no longer available for this update.");
    const studentInput = {
      ...prior,
      status: "UPDATE_IN_PROGRESS",
      runId,
      startedAt: this.clock().toISOString(),
      nextStep: "The agent is processing this response now. No separate Collect run is required.",
    };
    await this.memoryStore.upsertOpportunityState(opportunityId, { studentInput });
    await this.memoryStore.appendAction({
      runId,
      opportunityId,
      responseId,
      actionType: "TARGETED_OPPORTUNITY_UPDATE_STARTED",
      outcome: "SUCCESS",
    });
    return studentInput;
  }

  async markUpdateDeferred({ opportunityId, responseId, reason }) {
    const state = await this.memoryStore.getState();
    const prior = state.opportunities?.[opportunityId]?.studentInput;
    if (!prior || prior.responseId !== responseId) return null;
    const studentInput = {
      ...prior,
      status: "READY_FOR_UPDATE",
      nextStep: String(reason || "Your information remains saved. Select Update Opportunity to retry.").slice(0, 1_000),
    };
    await this.memoryStore.upsertOpportunityState(opportunityId, { studentInput });
    return studentInput;
  }
}

function normalizeTemplateTypes(value) {
  if (!Array.isArray(value) || value.length > 3) throw validationError("Choose no more than three application templates.");
  return [...new Set(value.map((item) => String(item).toUpperCase()))].filter((item) => {
    if (!TEMPLATE_TYPES.has(item)) throw validationError(`Unsupported application template: ${item}.`);
    return true;
  });
}

function cleanText(value) {
  const text = String(value ?? "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim();
  if (text.length > 4_000) throw validationError("The response is too long; keep it under 4,000 characters.");
  return text;
}

function defaultNote(type, templates) {
  if (type === "CONFIRM_COMPLETED") return "Student confirmed the current action is complete.";
  if (type === "NOT_INTERESTED") return "Student marked this opportunity as not interested.";
  return `Student requested: ${templates.join(", ")}.`;
}

function validationError(message) {
  const error = new TypeError(message);
  error.statusCode = 400;
  return error;
}

function notFoundError(message) {
  const error = new Error(message);
  error.statusCode = 404;
  return error;
}
