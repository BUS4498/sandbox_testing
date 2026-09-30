import { mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { interviewWordPlan } from "../lib/hosted/interview-word-plan.js";
import { createWordDraft } from "../lib/hosted/word-drafts.js";

const folder = await mkdtemp(join(process.cwd(), ".interview-render-"));
const output = join(folder, "synthetic-interview-practice.docx");
const plan = interviewWordPlan(
  { company: "Example Company", roleTitle: "AI Business Analyst Intern", postingUrl: "https://example.com/internship" },
  { reportedQuestions: [{ question: "Tell me about a process you improved.", roleMatch: "RELATED_ROLE", sourceName: "Example public candidate report", sourceDate: "2026", sourceUrl: "https://www.reddit.com/r/example/post" }], likelyQuestions: ["How would you document requirements for an AI-assisted workflow?", "How would you check that a dashboard answers the business question?", "Describe a time you had to clarify ambiguous stakeholder needs."], searchNotes: "Synthetic layout test only; no source was searched." },
);
await writeFile(output, createWordDraft(plan));
process.stdout.write(output);
