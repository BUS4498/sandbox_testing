import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { buildRoleDraftPlan, createWordDraft } from "../lib/hosted/word-drafts.js";

const output = process.argv[2];
const type = process.argv[3] ?? "TAILORED_RESUME";
if (!output || !["TAILORED_RESUME", "COVER_LETTER_DRAFT"].includes(type)) throw new Error("Provide an output DOCX path and a current draft type for synthetic layout QA.");

const record = {
  opportunityId: "synthetic-word-qa",
  company: "Example Analytics",
  roleTitle: "Business Systems Analyst Intern",
  postingUrl: "https://example.org/careers/synthetic-analyst-intern",
  assessmentProfileMode: "SYNTHETIC_DEMONSTRATION",
  fitEvidence: {
    requiredMatches: [
      "Verified undergraduate Information Systems coursework and business analysis project work",
      "Verified SQL querying and data validation in a course project",
      "Verified Excel reporting with PivotTables and lookup functions",
      "Verified process mapping and requirements documentation in a team project",
    ],
    preferredMatches: ["Verified Power BI dashboard project", "Verified introductory Python data-cleaning practice"],
    gaps: ["No verified production cloud data-pipeline work", "No verified full-time consulting-client delivery experience"],
    unknowns: ["Exact internship dates are not stated", "Onsite expectations need confirmation"],
  },
};

const drafted = {
  evidence: [
    { id: "E1", text: "B.S. Business Administration student with an Information Systems concentration and relevant systems-analysis coursework." },
    { id: "E2", text: "Used SQL to validate and analyze synthetic retail inventory records for an academic project." },
    { id: "E3", text: "Built a Power BI dashboard to summarize inventory trends and support course-project recommendations." },
    { id: "E4", text: "Improved an Excel reservation tracker and documented recurring process issues in a campus operations role." },
    { id: "E5", text: "Mapped the registration process for a student organization and drafted requirements for a clearer workflow." },
    { id: "E6", text: "Practiced Python data cleaning and Excel PivotTables in business analytics coursework." },
  ],
  resumeItems: [
    { section: "EDUCATION", evidenceId: "E1" },
    { section: "EXPERIENCE", evidenceId: "E4" },
    { section: "PROJECTS", evidenceId: "E2" },
    { section: "PROJECTS", evidenceId: "E3" },
    { section: "PROJECTS", evidenceId: "E5" },
    { section: "SKILLS", evidenceId: "E6" },
  ],
  letterParagraphs: [
    { text: "I am interested in the Business Systems Analyst Intern role at Example Analytics because it combines business requirements and data-informed process improvement, work I have been developing through my Information Systems studies.", evidenceIds: ["E1"] },
    { text: "In a campus operations role, I improved an Excel reservation tracker and documented recurring process issues. That experience helped me translate daily workflow problems into clearer information for the people using the process.", evidenceIds: ["E4"] },
    { text: "My academic work has included validating retail inventory records with SQL and building a Power BI dashboard to summarize trends. I also mapped a student-organization registration process and drafted requirements for a clearer workflow. I would welcome the chance to apply this combination of analysis and documentation to the internship team.", evidenceIds: ["E2", "E3", "E5"] },
    { text: "Thank you for considering my application. I would welcome an opportunity to discuss how my coursework and project experience could support the team's work.", evidenceIds: ["E1", "E2"] },
  ],
};
const bytes = createWordDraft(buildRoleDraftPlan(record, type, drafted), "2026-09-28T12:00:00.000Z");
await writeFile(resolve(output), bytes);
