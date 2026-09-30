import { mkdir, writeFile } from "node:fs/promises";
import { buildRoleDraftPlan, createWordDraft } from "../lib/hosted/word-drafts.js";
import { resumeLines } from "../lib/hosted/resume-structure.js";
import { prepareLetterForReview } from "../lib/hosted/material-draft-validation.js";

const record = { opportunityId: "synthetic-qa", company: "Example Analytics", roleTitle: "Business Systems Intern - Fall 2026/Winter 2027" };
const baseline = resumeLines("EDUCATION Example University B.S. Business Administration, Information Systems concentration, expected May 2028 • Relevant coursework in systems analysis and database management ChineseEXPERIENCE Campus office assistant • Maintained a reservation tracker and prepared weekly activity summaries • Documented the office process and supported routine scheduling hours.ACTIVITIES Student organization registration mapping • Identified repeated manual steps and proposed a revised process investorsADDITIONAL SKILLS & INTERESTS Excel, SQL, Python, Power BI, process mapping, GitHub");
const chosen = baseline.map((text, sourceIndex) => ({ text, sourceIndex })).filter((item) => item.text.startsWith("• ") || item.text.startsWith("Excel,"));
const evidence = chosen.map((item, index) => ({ id: `E${index + 1}`, ...item }));
const letter = prepareLetterForReview([
  { text: "I have worked on 15 business process improvement projects and am interested in this Business Systems Intern opportunity for Fall 2026/Winter 2027. The position's mix of stakeholder needs and practical systems work aligns with the direction I hope to explore.", evidenceIds: [] },
  { text: "In a campus office, I maintained a reservation tracker and prepared weekly activity summaries. Documenting the process helped colleagues identify repeated handoffs and provided a more consistent way to review incoming requests. I would bring the same care to understanding how this team defines and improves its workflows.", evidenceIds: ["E2"] },
  { text: "For a synthetic retail inventory project, I used SQL and Power BI to summarize records and turn them into a clear dashboard. I would welcome the chance to apply that preparation to the posting's data-quality and reporting responsibilities while learning from business and technical teammates. I would verify every proposed claim before sending a final application.", evidenceIds: ["E4"] },
  { text: "Thank you for considering this application. I would welcome a conversation about the role and the opportunity to learn how your team connects business needs with useful information systems.", evidenceIds: [] },
], evidence, record.roleTitle);
const drafted = {
  resumeBaseline: baseline,
  evidence,
  resumeItems: evidence.slice(0, 4).map((item) => ({ section: "EXPERIENCE", evidenceId: item.id })),
  resumeEdits: [],
  letterParagraphs: letter.paragraphs,
  verificationNotes: { COVER_LETTER_DRAFT: letter.verificationNotes },
};
await mkdir("outputs/qa", { recursive: true });
for (const [type, path] of [
  ["TAILORED_RESUME", "outputs/qa/tailored-resume-synthetic.docx"],
  ["COVER_LETTER_DRAFT", "outputs/qa/cover-letter-unverified-synthetic.docx"],
]) {
  await writeFile(path, createWordDraft(buildRoleDraftPlan(record, type, drafted)));
  process.stdout.write(`${path}\n`);
}
