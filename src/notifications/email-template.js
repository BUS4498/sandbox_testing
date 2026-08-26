const UPDATE_LABELS = Object.freeze({
  NEW_OPPORTUNITY: "New opportunity",
  EXISTING_OPPORTUNITY_UPDATE: "Existing opportunity updated",
  DEADLINE_STATUS_CHANGE: "Deadline or posting-status change",
  UNRESOLVED_ISSUE: "Unresolved issue",
});

/**
 * Build a routine student notification from verified structured information.
 * This intentionally requires no model call and discloses no resume/profile data.
 */
export function composeStudentUpdateEmail(input) {
  const updateLabel = UPDATE_LABELS[input.updateType];
  if (!updateLabel) throw new TypeError(`Unsupported notification update type: ${input.updateType}.`);

  const company = cleanHeaderValue(required(input.company, "company"));
  const roleTitle = cleanHeaderValue(required(input.roleTitle, "roleTitle"));
  const attention = input.attentionRequired === true ? "Yes" : "No";
  const subject = `[Internship update] ${updateLabel}: ${company} — ${roleTitle}`;
  const text = [
    "Hello,",
    "",
    "A material update was successfully recorded in your local internship collection.",
    "",
    `Update type: ${updateLabel}`,
    `Company: ${company}`,
    `Role: ${roleTitle}`,
    `What changed: ${display(input.whatChanged)}`,
    `Relevant deadline: ${display(input.deadline)}`,
    `Current recommendation: ${display(input.agentDecision)}`,
    `Why this matters: ${display(input.rationale)}`,
    `Recommended next action: ${display(input.nextAction)}`,
    `Student attention required: ${attention}`,
    "",
    "This is an informational message to you. No application or employer communication was sent.",
  ].join("\n");

  return Object.freeze({ subject, text });
}
function display(value) {
  if (value === null || value === undefined || String(value).trim() === "") return "Unknown";
  return String(value).trim().replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
}

function cleanHeaderValue(value) {
  if (/\r|\n/.test(value)) throw new TypeError("Email header values must not contain line breaks.");
  return value.replace(/[\u0000-\u001F\u007F]/g, "").trim();
}

function required(value, field) {
  if (value === null || value === undefined || String(value).trim() === "") {
    throw new TypeError(`${field} is required to compose a student notification.`);
  }
  return String(value);
}
