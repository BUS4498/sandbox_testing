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

test("long paragraphs are retained for Word wrapping, not sliced mid-sentence", () => {
  const source = `PROJECTS ${"Mapped student registration steps and verified handoffs. ".repeat(18)}`;
  const lines = resumeLines(source);
  assert.equal(lines.length, 2);
  assert.equal(lines.join(" ").replace(/\s+/g, " ").trim(), source.replace(/\s+/g, " ").trim());
});

test("compound headings and wrapped bullet sentences stay intact", () => {
  const source = "EDUCATION\nExample University\nTECHNICAL & RESEARCH\nEXPERIENCE\nOffice Assistant | Campus Office May 2025 - August 2025\n● Built 5+ Excel trackers supporting 8 teams using\nvalidation rules and predefined templates.\nLEADERSHIP\n& CAMPUS INVOLVEMENT\nStudent Club\n● Organized workshops.\nSKILLS & CERTIFICATES\nExcel | SQL";
  const lines = resumeLines(source);
  assert.deepEqual(lines.filter(isResumeSectionHeading), ["EDUCATION", "TECHNICAL & RESEARCH EXPERIENCE", "LEADERSHIP & CAMPUS INVOLVEMENT", "SKILLS & CERTIFICATES"]);
  assert.ok(lines.includes("• Built 5+ Excel trackers supporting 8 teams using validation rules and predefined templates."));
  assert.ok(lines.includes("Office Assistant | Campus Office May 2025 - August 2025"));
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

test("PDF letter spacing in section titles does not swallow Projects or Work Experience into a bullet", () => {
  const source = "EDUCATION\nExample University\n• Relevant coursework: Python\nP ROJECTS\nForecast workflow\n• Built a prototype.\nTECHNICAL SKILLS\n• Python and R\nWORK E XPERIENCE\nCampus Assistant\n• Managed inventory.\nLEADERSHIP AND INVOLVEMENT\nStudent Club";
  const lines = resumeLines(source);
  assert.deepEqual(lines.filter(isResumeSectionHeading), ["EDUCATION", "PROJECTS", "TECHNICAL SKILLS", "WORK EXPERIENCE", "LEADERSHIP AND INVOLVEMENT"]);
  assert.ok(lines.includes("• Relevant coursework: Python"));
  assert.ok(lines.includes("• Python and R"));
  assert.ok(lines.includes("Campus Assistant"));
});

test("legacy PDF bullet glyph becomes a real bullet without changing accomplishment wording", () => {
  const lines = resumeLines("EXPERIENCE\nCampus Office\n\uF0B7 Built 5+ Excel trackers.\n\uF0B7 Documented onboarding tasks.");
  assert.ok(lines.includes("• Built 5+ Excel trackers."));
  assert.ok(lines.includes("• Documented onboarding tasks."));
});
