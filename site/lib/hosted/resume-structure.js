const SECTION_NAMES = [
  "TECHNICAL & RESEARCH EXPERIENCE", "LEADERSHIP & CAMPUS INVOLVEMENT",
  "LEADERSHIP AND CAMPUS INVOLVEMENT", "LEADERSHIP AND INVOLVEMENT",
  "SKILLS & CERTIFICATES", "TECHNICAL & PROFESSIONAL SKILLS",
  "ADDITIONAL SKILLS & INTERESTS", "SKILLS & INTERESTS",
  "LEADERSHIP & INVOLVEMENT", "PROJECT EXPERIENCE", "WORK EXPERIENCE",
  "SKILLS & HONORS", "TECHNICAL SKILLS", "RELEVANT COURSEWORK",
  "CERTIFICATIONS", "ACTIVITIES", "EDUCATION", "EXPERIENCE",
  "PROJECTS", "SKILLS", "LEADERSHIP", "HONORS",
];
const escapePattern = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const sectionPattern = new RegExp(`(^|[ \\t\\n])(${SECTION_NAMES.map(escapePattern).join("|")})(?=[ \\t\\n]|$)`, "g");
// Some PDF extractors attach a styled heading to the preceding word or period.
const fusedSectionPattern = new RegExp(`(?<=[\\p{Ll}\\p{N}.!?])(${SECTION_NAMES.map(escapePattern).join("|")})(?=[ \\t\\n]|$)`, "gu");
const sectionSet = new Set(SECTION_NAMES);
// PDF character positioning can introduce gaps inside styled headings, e.g.
// P ROJECTS or WORK E XPERIENCE. Restrict repair to known uppercase headings;
// never rewrite the student's substantive sentences or skill names.
const spacedHeadingPatterns = SECTION_NAMES.map(name => ({ name,
  pattern: new RegExp(`(^|[ \\t\\n])${[...name].map(char => char === " " ? "[ \\t]+" : `${escapePattern(char)}[ \\t]*`).join("")}(?=[ \\t\\n]|$)`, "g"),
}));

/** Restore document boundaries lost when a PDF extractor returns one long line. */
export function resumeLines(profileText) {
  let source = String(profileText ?? "");
  for (const { name, pattern } of spacedHeadingPatterns) source = source.replace(pattern, (_match, before) => `${before}${name}`);
  const structured = source
    .replace(/\r\n?/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\bTECHNICAL\s*&\s*RESEARCH\s+EXPERIENCE\b/g, "TECHNICAL & RESEARCH EXPERIENCE")
    .replace(/\bLEADERSHIP\s*&\s*CAMPUS\s+INVOLVEMENT\b/g, "LEADERSHIP & CAMPUS INVOLVEMENT")
    .replace(/\bSKILLS\s*&\s*CERTIFICATES\b/g, "SKILLS & CERTIFICATES")
    .replace(/\bADDITIONAL[ \t\n]+SKILLS[ \t]*&[ \t]*INTERESTS\b/g, "ADDITIONAL SKILLS & INTERESTS")
    .replace(fusedSectionPattern, (_match, heading) => `\n${heading}\n`)
    .replace(sectionPattern, (_match, _before, heading) => `\n${heading}\n`)
    .replace(/[ \t]*[•●▪\uF0B7][ \t]*/g, "\n• ");
  const lines = structured.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  const result = [];
  for (const line of lines) {
    const previous = result.at(-1);
    const entry = /\||\b(?:Jan(?:uary)?|Feb(?:ruary)?|March|April|May|June|July|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+20\d\d|^[A-Z][A-Za-z &/-]+:/i.test(line);
    if (previous?.startsWith("• ") && !/[.!?]$/.test(previous) && !line.startsWith("• ") && !isResumeSectionHeading(line) && !entry) {
      result[result.length - 1] = `${previous} ${line}`;
    } else result.push(line);
  }
  return result;
}

export function isResumeSectionHeading(value) {
  return sectionSet.has(String(value ?? "").trim());
}
