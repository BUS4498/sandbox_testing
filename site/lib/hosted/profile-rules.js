export const DEFAULT_ROLE_CHOICES = Object.freeze([
  "AI Business Analyst Intern",
  "AI Systems Analyst Intern",
  "Business Process Automation Analyst Intern",
  "AI Product Analyst Intern",
  "Business Systems Analyst Intern",
  "Data or Business Intelligence Analyst Intern",
  "AI Transformation or Technology Consulting Intern",
]);

export function publicSearchProjection(preferences) {
  if (!preferences || typeof preferences !== "object") throw new TypeError("Confirmed search preferences are required.");
  return {
    roles: preferences.roles,
    broadGeography: preferences.geographicBoundaries,
    availableFrom: preferences.availableFrom,
    availableThrough: preferences.availableThrough,
    workArrangements: preferences.workArrangements,
  };
}

const ARRANGEMENTS = new Set(["HYBRID", "REMOTE", "ONSITE"]);
const PAID = new Set(["REQUIRED", "PREFERRED", "NO_RESTRICTION"]);
const RELOCATION = new Set(["NO", "YES", "CONDITIONAL"]);
const AUTHORIZATION = new Set(["AUTHORIZED_NO_SPONSORSHIP", "REQUIRES_SPONSORSHIP", "UNSURE_OR_PREFER_NOT_TO_STATE"]);
const DIRECT_IDENTIFIER = [
  ["email address", /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i],
  ["phone number", /(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}/],
  ["personal URL", /\b(?:https?:\/\/|www\.|linkedin\.com\/in\/|github\.com\/)\S*/i],
  ["street address", /\b\d{1,6}\s+[A-Za-z0-9.' -]+\s(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr|Court|Ct|Way)\b/i],
];

export function assertNoDirectIdentifier(parts, subject = "reviewed setup") {
  const joined = parts.join("\n");
  for (const [label, pattern] of DIRECT_IDENTIFIER) {
    if (pattern.test(joined)) throw new TypeError(`Remove the detected ${label} from the ${subject}.`);
  }
}

function text(value, label, max) {
  if (typeof value !== "string") throw new TypeError(`${label} is required.`);
  const result = value.replace(/\r\n?/g, "\n").trim();
  if (!result || result.length > max) throw new TypeError(`${label} must contain 1–${max} characters.`);
  return result;
}

function optionalText(value, label, max) {
  if (value == null || value === "") return "";
  if (typeof value !== "string") throw new TypeError(`${label} must be text.`);
  const result = value.trim();
  if (result.length > max) throw new TypeError(`${label} must be ${max} characters or fewer.`);
  return result;
}

function choices(value, allowed, label) {
  if (!Array.isArray(value)) throw new TypeError(`${label} must be selected.`);
  const selected = [...new Set(value)];
  if (selected.length === 0 || selected.length > allowed.size || selected.some((item) => !allowed.has(item))) {
    throw new TypeError(`Select at least one valid ${label.toLowerCase()}.`);
  }
  return selected;
}

function date(value, label) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) {
    throw new TypeError(`${label} must be a valid date.`);
  }
  return value;
}

export function normalizeRealSetup(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new TypeError("Student setup is required.");
  if (input.confirmedNoIdentifiers !== true || input.apiAssessmentConsent !== true) {
    throw new TypeError("Review the profile, remove direct identifiers, and confirm API assessment consent before saving.");
  }
  const profileText = text(input.profileText, "Reviewed resume profile", 30_000);
  if (profileText.length < 40) throw new TypeError("The reviewed resume profile needs at least 40 characters of relevant evidence.");
  const rawCustomRoles = input.customRoles ?? (input.customRole ? [input.customRole] : []);
  if (!Array.isArray(rawCustomRoles) || rawCustomRoles.length > 8) {
    throw new TypeError("Add no more than eight custom preferred roles.");
  }
  const customRoles = rawCustomRoles.map((role) => text(role, "Custom role", 120));
  if (!Array.isArray(input.roles) || input.roles.length > DEFAULT_ROLE_CHOICES.length || input.roles.some((role) => !DEFAULT_ROLE_CHOICES.includes(role))) {
    throw new TypeError("Select valid preferred internship roles.");
  }
  const roleChoices = [...new Set(input.roles)];
  const allRoles = [...roleChoices, ...customRoles];
  if (allRoles.length === 0) throw new TypeError("Select or add at least one preferred role.");
  if (new Set(allRoles.map((role) => role.toLocaleLowerCase())).size !== allRoles.length) {
    throw new TypeError("Each preferred role must be distinct.");
  }
  const availableFrom = date(input.availableFrom, "Availability start");
  const availableThrough = date(input.availableThrough, "Availability end");
  if (availableThrough < availableFrom) throw new TypeError("Availability end must be on or after the start date.");
  const hoursPerWeek = Number(input.hoursPerWeek);
  if (!Number.isInteger(hoursPerWeek) || hoursPerWeek < 1 || hoursPerWeek > 80) throw new TypeError("Hours per week must be a whole number from 1 to 80.");
  if (!PAID.has(input.paidPreference)) throw new TypeError("Select a paid-internship preference.");
  if (!RELOCATION.has(input.relocationFlexibility)) throw new TypeError("Select relocation flexibility.");
  if (!AUTHORIZATION.has(input.workAuthorization)) throw new TypeError("Select a work-authorization answer, including Unsure if needed.");
  const workArrangements = choices(input.workArrangements, ARRANGEMENTS, "work arrangement");
  const geographicBoundaries = text(input.geographicBoundaries, "Geographic boundaries", 500);
  const additionalConstraints = optionalText(input.additionalConstraints, "Additional constraints", 1_000);
  assertNoDirectIdentifier([profileText, ...customRoles, geographicBoundaries, additionalConstraints]);
  return {
    profileText,
    preferences: {
      roles: allRoles,
      availableFrom, availableThrough, hoursPerWeek,
      paidPreference: input.paidPreference,
      relocationFlexibility: input.relocationFlexibility,
      workAuthorization: input.workAuthorization,
      workArrangements, geographicBoundaries, additionalConstraints,
    },
  };
}
