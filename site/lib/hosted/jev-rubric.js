import { assessmentMatchesSetup } from "./opportunity-state.js";

export const JEV_MODEL = "jev-1.13.0";
export const RUBRIC_VERSION = "preliminary-fit-v1";

const SIGNALS = [
  ["AI and automation", /\b(ai|artificial intelligence|automation|machine learning)\b/i],
  ["business analysis", /business analy|requirements|stakeholder/i],
  ["systems analysis", /systems? analy|information systems|process map/i],
  ["data analysis", /data analy|analytics|statistics/i],
  ["SQL", /\bsql\b/i],
  ["Python", /\bpython\b/i],
  ["Excel", /\bexcel\b|pivot.?table|xlookup/i],
  ["Power BI", /power\s*bi/i],
  ["product operations", /product|operations/i],
  ["consulting", /consult/i],
  ["communication", /communicat|present|cross.functional/i],
];

function usable(items) {
  return (Array.isArray(items) ? items : [])
    .filter((item) => typeof item === "string" && item.trim() && !/^(none|no (known|verified|clear) (gaps?|unknowns?))\.?$/i.test(item.trim()));
}

function labels(items) {
  const text = usable(items).join(" ");
  return SIGNALS.filter(([, pattern]) => pattern.test(text)).map(([label]) => label);
}

function roleCategory(value) {
  const text = String(value ?? "");
  if (/\b(ai|artificial intelligence)\b/i.test(text) && /analyst|systems|product|transform/i.test(text)) return "AI-related analysis";
  if (/business process|automation/i.test(text)) return "process automation";
  if (/business systems|systems analyst|information systems/i.test(text)) return "systems analysis";
  if (/business analyst/i.test(text)) return "business analysis";
  if (/data analyst|business intelligence|\bbi\b/i.test(text)) return "data and BI analysis";
  if (/product/i.test(text)) return "product work";
  if (/consult/i.test(text)) return "technology consulting";
  if (/operations/i.test(text)) return "operations";
  return "other or unclear role";
}

function locationCategory(value) {
  const text = String(value ?? "");
  if (/\bremote\b/i.test(text)) return "remote";
  if (/\b(CA|California|Los Angeles|San Diego|San Francisco|Sacramento|San Jose|Irvine|Pasadena|Long Beach|Santa Barbara|San Luis Obispo)\b/i.test(text)) return "California";
  return text.trim() && !/^unknown$/i.test(text.trim()) ? "other or unclear location" : "unknown";
}

function arrangement(value) {
  const text = String(value ?? "");
  return /hybrid/i.test(text) ? "HYBRID" : /remote/i.test(text) ? "REMOTE" : /on.?site|in.person/i.test(text) ? "ONSITE" : "UNKNOWN";
}

function monthWindow(from, through) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(from)) || !/^\d{4}-\d{2}-\d{2}$/.test(String(through))) return "unknown";
  return `${String(from).slice(0, 7)} through ${String(through).slice(0, 7)}`;
}

function postingPeriod(value) {
  const match = String(value ?? "").match(/\b(Spring|Summer|Fall|Autumn|Winter)\s+20\d{2}\b/i);
  return match ? `${match[1].toLowerCase()} ${match[0].match(/20\d{2}/)[0]}` : "unknown";
}

export function compactFitEvidence(record, setup) {
  if (!setup?.ready || !["REAL", "SYNTHETIC_DEMONSTRATION"].includes(setup.mode)) return null;
  // Records created before real-student setup existed have no mode marker.
  // They were assessed only with the synthetic demonstration profile.
  if (!assessmentMatchesSetup(record, setup) || record?.postingStatus !== "ACTIVE") return null;
  // Older targeted updates retained the category followed by a narrative.
  // Preserve those records, but still reject assessments without a clear category.
  if (!/^(?:STRONG|MODERATE|WEAK)(?:$|:\s)/i.test(String(record.fitAssessment ?? "").trim())) return null;
  if (!record.postingUrl || !record.lastVerified || !record.decisionRationale) return null;
  const required = usable(record.fitEvidence?.requiredMatches);
  const preferred = usable(record.fitEvidence?.preferredMatches);
  const gaps = usable(record.fitEvidence?.gaps);
  const unknowns = usable(record.fitEvidence?.unknowns);
  if (required.length + gaps.length < 1 || required.length + preferred.length + gaps.length + unknowns.length < 2) return null;
  const preferences = setup.preferences ?? {};
  const preferredRoles = Array.isArray(preferences.roles) ? preferences.roles : ["AI Business Analyst Intern", "AI Systems Analyst Intern", "Business Systems Analyst Intern", "Data Analyst Intern"];
  const allowedArrangements = Array.isArray(preferences.workArrangements) ? preferences.workArrangements.filter((item) => ["HYBRID", "REMOTE", "ONSITE"].includes(item)) : ["HYBRID", "REMOTE", "ONSITE"];
  return {
    qualification: {
      requiredMatches: required.length, preferredMatches: preferred.length,
      gaps: gaps.length, unknowns: unknowns.length,
      matchTopics: labels([...required, ...preferred]), gapTopics: labels(gaps), unknownTopics: labels(unknowns),
    },
    career: {
      roleCategory: roleCategory(record.roleTitle),
      preferredRoleCategories: [...new Set(preferredRoles.map(roleCategory))].slice(0, 8),
      preferenceAlignmentObservations: usable(record.fitEvidence?.preferenceAlignment).length,
      alignmentTopics: labels(record.fitEvidence?.preferenceAlignment),
    },
    practical: {
      postingLocationCategory: locationCategory(record.location),
      studentGeography: setup.mode === "SYNTHETIC_DEMONSTRATION" ? "California preferred" : /\bCalifornia\b/i.test(String(preferences.geographicBoundaries ?? "")) ? "California mentioned in confirmed boundaries" : "unspecified broad geography",
      workArrangement: arrangement(record.workArrangement),
      acceptedWorkArrangements: allowedArrangements,
      postingInternshipPeriod: postingPeriod(record.internshipPeriod),
      studentAvailabilityWindow: setup.mode === "SYNTHETIC_DEMONSTRATION" ? "2027-05 through 2027-08" : monthWindow(preferences.availableFrom, preferences.availableThrough),
      deadlineKnown: Boolean(record.deadline && !/^unknown$/i.test(record.deadline)),
    },
  };
}

const LEVELS = {
  qualifications: [
    "Verified evidence shows a blocking required-qualification gap or no supported required match",
    "Few required qualifications are supported and several genuine gaps remain",
    "Some required qualifications are supported, with meaningful gaps or unknowns",
    "Most relevant required qualifications are supported; remaining gaps appear manageable",
    "Relevant required qualifications are well supported with no material known gap",
  ],
  career: [
    "Role duties and category are outside the student's stated career interests",
    "Only a limited connection to the student's preferred role areas is evident",
    "A reasonable connection exists, but role focus is only partly aligned or unclear",
    "Role focus aligns with a stated preference and offers relevant work",
    "Role focus closely matches the student's highest-priority internship interests",
  ],
  practical: [
    "A verified location, work-arrangement, or timing constraint blocks this opportunity",
    "Practical fit is weak because one or more stated constraints likely conflict",
    "Practical fit is possible, but material location, arrangement, or timing facts are uncertain",
    "Known location, arrangement, and timing facts are mostly compatible",
    "Known practical conditions clearly align with the student's stated constraints",
  ],
};

export function scoreQuestions() {
  return {
    qualifications: { type: "score", instructions: "Using only verified qualification evidence in state, how well do the student's verified qualifications align with this internship's requirements? Do not infer missing skills or count self-reported qualifications as verified. Treat unknowns as uncertainty, not matches.", criteria: LEVELS.qualifications },
    career: { type: "score", instructions: "Using only career evidence in state, how closely does the role align with the student's stated internship interests? A category match alone is not proof of duties.", criteria: LEVELS.career },
    practical: { type: "score", instructions: "Using only practical evidence in state, how compatible are location, work arrangement, and internship timing with the student's known constraints? Unknown facts must remain uncertain.", criteria: LEVELS.practical },
  };
}

export function normalizeJevAnswer(payload) {
  const answers = payload?.answers;
  const weights = { qualifications: 0.6, career: 0.25, practical: 0.15 };
  let weighted = 0;
  const components = /** @type {Record<string, number>} */ ({});
  for (const [key, weight] of Object.entries(weights)) {
    const answer = answers?.[key];
    if (answer?.type !== "score" || typeof answer.score !== "number" || !Number.isFinite(answer.score) || answer.score < 0 || answer.score > 4 || typeof answer.confidence !== "number" || answer.confidence < 0 || answer.confidence > 1) {
      throw new TypeError("TypeSafe returned an invalid fit-score response.");
    }
    components[key] = Math.round(answer.score * 25 / 5) * 5;
    weighted += answer.score * weight;
  }
  return { value: Math.max(0, Math.min(100, Math.round((weighted / 4 * 100) / 5) * 5)), components };
}
