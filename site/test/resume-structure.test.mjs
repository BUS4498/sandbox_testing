import test from "node:test";
import assert from "node:assert/strict";
import { isResumeSectionHeading, resumeLines } from "../lib/hosted/resume-structure.js";

test("run-together extracted resume text regains section and bullet boundaries without dropping words", () => {
  const source = "EDUCATION Example University B.S. Business Administration Information Systems • Relevant coursework in databases and analytics WORK EXPERIENCE Campus Office Assistant May 2025 to present • Improved an Excel tracker for reservations • Documented recurring process issues PROJECTS Inventory dashboard • Used SQL and Power BI SKILLS Excel, SQL, GitHub";
  const lines = resumeLines(source);
  assert.deepEqual(lines.filter(isResumeSectionHeading), ["EDUCATION", "WORK EXPERIENCE", "PROJECTS", "SKILLS"]);
  assert.equal(lines.filter((line) => line.startsWith("• ")).length, 4);
  assert.ok(lines.indexOf("EDUCATION") < lines.findIndex((line) => line.includes("Example University")));
  assert.ok(lines.indexOf("WORK EXPERIENCE") < lines.findIndex((line) => line.includes("Campus Office")));
  const words = (value) => value.toLowerCase().match(/[\p{L}\p{N}]+/gu)?.join("|");
  assert.equal(words(lines.join(" ")), words(source));
});

test("long extracted lines are broken into readable paragraphs, not truncated", () => {
  const source = `PROJECTS ${"Mapped student registration steps and verified handoffs. ".repeat(18)}`;
  const lines = resumeLines(source);
  assert.ok(lines.length > 3);
  assert.ok(lines.every((line) => line.length <= 380));
  assert.equal(lines.join(" ").replace(/\s+/g, " ").trim(), source.replace(/\s+/g, " ").trim());
});

test("headings fused to prior PDF text become separate resume sections", () => {
  const source = "EDUCATION Example University • Minors: Computer Science, Psychology, ChineseEXPERIENCE Polygence Remote • Conducted research during the semester hours.ACTIVITIES Delta Sigma Pi • Organized workshops for students investorsADDITIONAL SKILLS & INTERESTS Languages and Technical Skills: Python, SQL, Excel";
  const lines = resumeLines(source);
  assert.deepEqual(lines.filter(isResumeSectionHeading), ["EDUCATION", "EXPERIENCE", "ACTIVITIES", "ADDITIONAL SKILLS & INTERESTS"]);
  assert.ok(lines.indexOf("EXPERIENCE") < lines.indexOf("Polygence Remote"));
  assert.ok(lines.indexOf("ACTIVITIES") < lines.indexOf("Delta Sigma Pi"));
  assert.ok(lines.indexOf("ADDITIONAL SKILLS & INTERESTS") < lines.findIndex((line) => line.startsWith("Languages and Technical Skills")));
  assert.ok(lines.includes("• Minors: Computer Science, Psychology, Chinese"));
});
