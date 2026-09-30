const SECTION_NAMES = [
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

/** Restore document boundaries lost when a PDF extractor returns one long line. */
export function resumeLines(profileText) {
  const structured = String(profileText ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\bADDITIONAL[ \t\n]+SKILLS[ \t]*&[ \t]*INTERESTS\b/g, "ADDITIONAL SKILLS & INTERESTS")
    .replace(fusedSectionPattern, (_match, heading) => `\n${heading}\n`)
    .replace(sectionPattern, (_match, _before, heading) => `\n${heading}\n`)
    .replace(/[ \t]*[•●▪][ \t]*/g, "\n• ");
  return structured.split(/\n+/).map((line) => line.trim()).filter(Boolean).flatMap((line) => splitLongLine(line));
}

export function isResumeSectionHeading(value) {
  return sectionSet.has(String(value ?? "").trim());
}

function splitLongLine(line) {
  if (line.length <= 380 || isResumeSectionHeading(line)) return [line];
  const bullet = line.startsWith("• ");
  const words = (bullet ? line.slice(2) : line).split(/\s+/).filter(Boolean);
  const parts = [];
  let current = "";
  for (const word of words) {
    if (current && current.length + word.length + 1 > 380) {
      parts.push(current);
      current = "";
    }
    current += `${current ? " " : ""}${word}`;
  }
  if (current) parts.push(current);
  if (bullet && parts.length) parts[0] = `• ${parts[0]}`;
  return parts;
}
