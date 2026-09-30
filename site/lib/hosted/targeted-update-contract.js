const string = { type: "string" };

export const TARGETED_UPDATE_JSON_SCHEMA = {
  type: "object", additionalProperties: false,
  required: ["opportunityId", "responseId", "resolution", "agentDecision", "decisionRationale", "fitAssessment", "resolvedGapIndexes", "resolvedUnknownIndexes", "nextAction", "nextQuestion", "whatHappensNext", "unresolvedIssue", "attentionRequired", "responseExplanation"],
  properties: {
    opportunityId: string, responseId: string,
    resolution: { type: "string", enum: ["RESOLVED", "PARTIAL", "UNRESOLVED"] },
    agentDecision: { type: "string", enum: ["PRIORITIZE", "MONITOR", "PREPARE", "FOLLOW UP", "ARCHIVE", "ESCALATE TO USER"] },
    decisionRationale: string, fitAssessment: { type: "string", enum: ["STRONG", "MODERATE", "WEAK", "INSUFFICIENT INFORMATION"] },
    resolvedGapIndexes: { type: "array", items: { type: "integer" } },
    resolvedUnknownIndexes: { type: "array", items: { type: "integer" } },
    nextAction: string, nextQuestion: string, whatHappensNext: string,
    unresolvedIssue: string, attentionRequired: { type: "boolean" }, responseExplanation: string,
  },
};

const keys = new Set(TARGETED_UPDATE_JSON_SCHEMA.required);
function boundedText(value, label, required = false) {
  if (typeof value !== "string" || value.length > 1_500 || (required && !value.trim())) throw new TypeError(`${label} is missing or too long.`);
  return value.trim();
}
function indexes(value, maximum, label) {
  if (!Array.isArray(value) || value.length > maximum || value.some((item) => !Number.isInteger(item) || item < 0 || item >= maximum)) {
    throw new TypeError(`${label} contains an invalid evidence reference.`);
  }
  if (new Set(value).size !== value.length) throw new TypeError(`${label} repeats an evidence reference.`);
  return value;
}

export function validateTargetedUpdate(raw, expected) {
  const result = typeof raw === "string" ? JSON.parse(raw) : raw;
  if (!result || typeof result !== "object" || Array.isArray(result) || Object.keys(result).length !== keys.size || Object.keys(result).some((key) => !keys.has(key))) {
    throw new TypeError("The scoped update contained unexpected fields.");
  }
  if (result.opportunityId !== expected.opportunityId || result.responseId !== expected.responseId) {
    throw new TypeError("The scoped update referred to a different opportunity or response.");
  }
  if (!["RESOLVED", "PARTIAL", "UNRESOLVED"].includes(result.resolution)) throw new TypeError("The response resolution was invalid.");
  if (!["PRIORITIZE", "MONITOR", "PREPARE", "FOLLOW UP", "ARCHIVE", "ESCALATE TO USER"].includes(result.agentDecision)) throw new TypeError("The decision was invalid.");
  if (!["STRONG", "MODERATE", "WEAK", "INSUFFICIENT INFORMATION"].includes(result.fitAssessment)) throw new TypeError("The fit assessment was invalid.");
  if (typeof result.attentionRequired !== "boolean") throw new TypeError("The attention status was invalid.");
  for (const label of ["decisionRationale", "nextAction", "responseExplanation"]) boundedText(result[label], label, true);
  for (const label of ["nextQuestion", "whatHappensNext", "unresolvedIssue"]) boundedText(result[label], label);
  if (result.resolution !== "RESOLVED" && !result.nextQuestion.trim() && !result.unresolvedIssue.trim()) {
    throw new TypeError("An unresolved response needs a specific remaining question or issue.");
  }
  indexes(result.resolvedGapIndexes, expected.gapCount, "Resolved gaps");
  indexes(result.resolvedUnknownIndexes, expected.unknownCount, "Resolved unknowns");
  return result;
}
