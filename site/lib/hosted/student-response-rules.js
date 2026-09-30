import { assertNoDirectIdentifier } from "./profile-rules.js";

const RESPONSE_TYPES = new Set(["INFORMATION", "CONFIRMATION", "UNKNOWN", "NOT_INTERESTED"]);

export function normalizeStudentResponse(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new TypeError("Choose an opportunity and response.");
  const opportunityId = input.opportunityId;
  if (typeof opportunityId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(opportunityId)) {
    throw new TypeError("Choose a valid tracked opportunity.");
  }
  const recordVersion = Number(input.recordVersion);
  if (!Number.isSafeInteger(recordVersion) || recordVersion < 1) throw new TypeError("Refresh this opportunity before responding.");
  if (!RESPONSE_TYPES.has(input.responseType)) throw new TypeError("Choose how you want to respond.");
  if (typeof input.responseText !== "string") throw new TypeError("Your response must be text.");
  const responseText = input.responseText.replace(/\r\n?/g, "\n").trim();
  if (responseText.length > 1_500) throw new TypeError("Keep your response under 1,500 characters.");
  if (["INFORMATION", "CONFIRMATION"].includes(input.responseType) && responseText.length < 10) {
    throw new TypeError("Give a specific answer of at least 10 characters so the agent can reassess this opportunity.");
  }
  if (["INFORMATION", "CONFIRMATION"].includes(input.responseType) && input.apiAssessmentConsent !== true) {
    throw new TypeError("Confirm that this non-identifying response may be reviewed by OpenAI for this opportunity.");
  }
  assertNoDirectIdentifier([responseText], "student response");
  return { opportunityId, recordVersion, responseType: input.responseType, responseText };
}
