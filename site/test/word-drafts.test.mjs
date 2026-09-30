import test from "node:test";
import assert from "node:assert/strict";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { buildDraftPlan, buildRoleDraftPlan, createWordDraft, DRAFT_NOTICE, refreshResumeWordLayout, verifyWordDraft } from "../lib/hosted/word-drafts.js";
import { resumeLines } from "../lib/hosted/resume-structure.js";
import { UNVERIFIED_LABEL } from "../lib/hosted/material-draft-validation.js";

test("saved resume typography refresh leaves all wording, highlights, and other styles intact", () => {
  const baseline = ['EDUCATION', 'Example University B.S. Information Systems', 'EXPERIENCE', 'Campus Office', '• Built an Excel tracker for 5 teams.', '• Documented recurring requests.', 'SKILLS', 'SQL | Excel'];
  const evidence = baseline.filter(text => !['EDUCATION', 'EXPERIENCE', 'SKILLS'].includes(text)).map((text, index) => ({ id: `E${index + 1}`, text, sourceIndex: baseline.indexOf(text) }));
  const plan = buildRoleDraftPlan(record, 'TAILORED_RESUME', { evidence, resumeBaseline: baseline, resumeItems: evidence.slice(0, 4).map(item => ({section: 'EXPERIENCE', evidenceId: item.id})), resumeEdits: [], letterParagraphs: [] });
  const files = unzipSync(createWordDraft(plan));
  const oldStyles = strFromU8(files['word/styles.xml']).replace(/(<w:style w:type="paragraph" w:styleId="ResumeBody"[\s\S]*?)<w:spacing[^>]*\/>/, '$1<w:spacing w:after="140" w:line="290" w:lineRule="auto"/>');
  files['word/styles.xml'] = strToU8(oldStyles);
  const refreshed = unzipSync(refreshResumeWordLayout(zipSync(files)));
  assert.equal(strFromU8(refreshed['word/document.xml']), strFromU8(files['word/document.xml']));
  assert.match(strFromU8(refreshed['word/styles.xml']), /ResumeBody[\s\S]*?w:after="20" w:line="240"/);
  const coverStyle = value => value.match(/<w:style w:type="paragraph" w:styleId="LetterNormal"[\s\S]*?<\/w:style>/)[0];
  assert.equal(coverStyle(strFromU8(refreshed['word/styles.xml'])), coverStyle(oldStyles));
  assert.equal(verifyWordDraft(refreshResumeWordLayout(zipSync(files)), 'Tailored Resume Draft'), true);
});

const record = {
  opportunityId: "synthetic-opportunity-1",
  company: "Example Analytics",
  roleTitle: "Business Systems Intern",
  postingUrl: "https://example.org/careers/123",
  assessmentProfileMode: "SYNTHETIC_DEMONSTRATION",
  fitEvidence: {
    requiredMatches: ["Verified SQL coursework and a reporting project"],
    preferredMatches: ["Verified Power BI dashboard project"],
    gaps: ["No verified cloud-platform experience"],
    unknowns: ["Work arrangement is not stated"],
  },
};

test("legacy review-only types remain readable under their original labels", () => {
  for (const type of ["RESUME_TAILORING_CHECKLIST", "COVER_LETTER_OUTLINE", "APPLICATION_QUESTION_WORKSHEET"]) {
    const plan = buildDraftPlan(record, type);
    const bytes = createWordDraft(plan, "2026-09-28T12:00:00.000Z");
    assert.equal(verifyWordDraft(bytes, plan.title), true);
    const files = unzipSync(bytes);
    const document = strFromU8(files["word/document.xml"]);
    assert.ok(document.includes(DRAFT_NOTICE));
    assert.ok(document.includes("Example Analytics"));
    assert.ok(document.includes("Business Systems Intern"));
    assert.ok(document.includes("Student review checklist"));
    assert.ok(document.includes("Nothing has been submitted or sent"));
    assert.ok(document.includes("w:numPr"), "the Word document should contain real list numbering");
    assert.ok(files["word/styles.xml"]);
    assert.ok(files["word/numbering.xml"]);
  }
});

test("new resume and cover letter are substantive drafts with verified text, highlighting, and Cal Poly-inspired styles", () => {
  const evidence = [
    { id: "E1", text: "Information Systems coursework included SQL and process mapping." },
    { id: "E2", text: "Improved an Excel tracker for a campus office." },
    { id: "E3", text: "Built a Power BI dashboard for a course project." },
    { id: "E4", text: "Documented requirements for a student registration process." },
  ];
  const drafted = {
    evidence,
    resumeBaseline: ["EDUCATION", evidence[0].text, "EXPERIENCE", evidence[1].text, "Kept an unrelated but valid original resume line.", "PROJECTS", evidence[2].text, evidence[3].text],
    resumeItems: [
      { section: "EDUCATION", evidenceId: "E1" },
      { section: "EXPERIENCE", evidenceId: "E2" },
      { section: "PROJECTS", evidenceId: "E3" },
      { section: "SKILLS", evidenceId: "E4" },
    ],
    resumeEdits: [{ evidenceId: "E3", revisedText: "For a course project, built a Power BI dashboard." }],
    letterParagraphs: [
      { text: "I am interested in this business systems internship because it joins analysis and process improvement.", evidenceIds: ["E1"] },
      { text: "In a campus office, I improved an Excel tracker and documented the work needed to keep records current.", evidenceIds: ["E2"] },
      { text: "For a course project, I built a Power BI dashboard that helped me communicate what the data showed.", evidenceIds: ["E3"] },
      { text: "Thank you for considering my application. I would welcome the chance to discuss this work.", evidenceIds: ["E4"] },
    ],
  };
  const resume = createWordDraft(buildRoleDraftPlan(record, "TAILORED_RESUME", drafted));
  const resumeXml = strFromU8(unzipSync(resume)["word/document.xml"]);
  assert.ok(resumeXml.includes("Improved an Excel tracker"));
  assert.ok(resumeXml.includes("What changed and why"));
  assert.ok(resumeXml.includes("Original:"));
  assert.ok(resumeXml.includes("Proposed: For a course project, built a Power BI dashboard."), "a verified wording revision should be explained alongside its original");
  assert.ok(resumeXml.includes("Kept an unrelated but valid original resume line."), "tailoring must retain unchanged original content");
  assert.ok(resumeXml.includes('w:highlight w:val="yellow"'));
  assert.ok((resumeXml.match(/w:highlight w:val="yellow"/g) ?? []).length >= 1, "actual changes should be highlighted in inline runs");
  assert.ok(resumeXml.includes('<w:rPr></w:rPr><w:t xml:space="preserve">a Power BI '), "unchanged wording must stay unhighlighted");
  assert.ok(resumeXml.includes('w:pStyle w:val="ResumeSection"'));
  assert.ok(resumeXml.includes("[Your name]"));
  assert.ok(!resumeXml.includes("Student review checklist"));
  const letter = createWordDraft(buildRoleDraftPlan(record, "COVER_LETTER_DRAFT", drafted));
  const letterXml = strFromU8(unzipSync(letter)["word/document.xml"]);
  const stylesXml = strFromU8(unzipSync(letter)["word/styles.xml"]);
  assert.ok(letterXml.includes("Thank you for considering my application"));
  assert.ok(letterXml.includes("Dear Hiring Team"));
  assert.ok(stylesXml.includes("154734"));
  assert.equal(verifyWordDraft(resume, "Tailored Resume Draft"), true);
  assert.equal(verifyWordDraft(letter, "Cover Letter Draft"), true);
});

test("collapsed resume extraction still produces distinct sections and bullets without blanket highlighting", () => {
  const baseline = resumeLines("EDUCATION Example University B.S. Information Systems • Studied databases and operations WORK EXPERIENCE Campus Office Assistant • Built an Excel scheduling tracker • Documented support requests PROJECTS Student registration mapping • Identified repeat handoffs SKILLS SQL, Python, Power BI, GitHub");
  const selected = baseline.map((text, sourceIndex) => ({ text, sourceIndex })).filter((item) => item.text.startsWith("• ") || item.text.startsWith("SQL,"));
  const evidence = selected.map((item, index) => ({ id: `E${index + 1}`, ...item }));
  const drafted = { evidence, resumeBaseline: baseline, resumeItems: evidence.slice(0, 4).map((item) => ({ section: "EXPERIENCE", evidenceId: item.id })), resumeEdits: [], letterParagraphs: [] };
  const document = strFromU8(unzipSync(createWordDraft(buildRoleDraftPlan(record, "TAILORED_RESUME", drafted)))["word/document.xml"]);
  assert.equal((document.match(/w:pStyle w:val="ResumeSection"/g) ?? []).length, 4);
  assert.ok((document.match(/w:pStyle w:val="ResumeBullet"/g) ?? []).length >= 3);
  assert.equal((document.match(/w:highlight w:val="yellow"/g) ?? []).length, 0);
  assert.ok(document.includes("Documented support requests"));
});

test("Word draft renders formerly fused Experience and Activities as real section headings", () => {
  const baseline = resumeLines("EDUCATION Example University • Minors: Computer Science, Psychology, ChineseEXPERIENCE Polygence Remote • Conducted research hours.ACTIVITIES Student Club • Organized workshops investorsADDITIONAL SKILLS & INTERESTS Python, SQL, Excel • Used SQL in a course project");
  const evidence = baseline.map((text, sourceIndex) => ({ text, sourceIndex })).filter((item) => item.text.startsWith("• ")).map((item, index) => ({ id: `E${index + 1}`, ...item }));
  const drafted = { evidence, resumeBaseline: baseline, resumeItems: evidence.map((item) => ({ section: "EXPERIENCE", evidenceId: item.id })), resumeEdits: [], letterParagraphs: [] };
  const xml = strFromU8(unzipSync(createWordDraft(buildRoleDraftPlan(record, "TAILORED_RESUME", drafted)))["word/document.xml"]);
  for (const title of ["EXPERIENCE", "ACTIVITIES", "ADDITIONAL SKILLS &amp; INTERESTS"]) {
    assert.match(xml, new RegExp(`<w:pStyle w:val="ResumeSection"\\/><w:keepNext\\/><w:keepLines\\/>[\\s\\S]*?<w:t xml:space="preserve">${title}<\\/w:t>`));
  }
  assert.match(xml, /<w:pStyle w:val="ResumeBullet"\/><w:keepLines\/>/);
  assert.doesNotMatch(xml, /ChineseEXPERIENCE|hours\.ACTIVITIES|investorsADDITIONAL/);
});

test("unverified letter wording is visibly labeled and followed by separate student notes", () => {
  const drafted = {
    evidence: [{ id: "E1", text: "Built a Power BI dashboard for a course project." }],
    resumeBaseline: [], resumeItems: [], resumeEdits: [],
    letterParagraphs: [
      { text: `${UNVERIFIED_LABEL} I have worked on process-improvement projects and welcome this role.`, evidenceIds: [] },
      { text: "For a course project, I built a Power BI dashboard to review a synthetic inventory dataset.", evidenceIds: ["E1"] },
      { text: "The posting's data and process responsibilities are relevant to that verified project work.", evidenceIds: ["E1"] },
      { text: "Thank you for considering this application. I would welcome a conversation about the role.", evidenceIds: [] },
    ],
    verificationNotes: { COVER_LETTER_DRAFT: ["Paragraph 1: Confirm or remove the proposed process-improvement claim against your original resume."] },
  };
  const plan = buildRoleDraftPlan(record, "COVER_LETTER_DRAFT", drafted);
  const document = strFromU8(unzipSync(createWordDraft(plan))["word/document.xml"]);
  assert.ok(document.includes('w:pStyle w:val="LetterUnverified"'));
  assert.ok(document.includes("STUDENT VERIFICATION NOTES — NOT PART OF THE COVER LETTER"));
  assert.ok(document.includes("Confirm or remove the proposed process-improvement claim"));
  assert.equal((document.match(/w:pStyle w:val="LetterNotice"/g) ?? []).length, 1);
  assert.match(document, /STUDENT VERIFICATION NOTES — NOT PART OF THE COVER LETTER[\s\S]*?Student review required — verify every claim/);
  assert.ok(plan.placeholders.some((item) => item.includes("Paragraph 1")));
});

test("resume with rejected optional edits retains every original line and flags the omission", () => {
  const evidence = [
    { id: "E1", text: "Verified education and coursework." },
    { id: "E2", text: "Verified campus work experience." },
    { id: "E3", text: "Verified course project." },
    { id: "E4", text: "Verified reporting skill." },
  ];
  const drafted = {
    evidence, resumeBaseline: ["EDUCATION", ...evidence.map((item) => item.text), "Original unrelated experience remains."],
    resumeItems: evidence.map((item) => ({ section: "EXPERIENCE", evidenceId: item.id })),
    resumeEdits: [], letterParagraphs: [],
    preparationNotices: { TAILORED_RESUME: "Unsafe proposed wording edits were omitted; the complete original resume was preserved without misleading highlights." },
  };
  const bytes = createWordDraft(buildRoleDraftPlan(record, "TAILORED_RESUME", drafted));
  const document = strFromU8(unzipSync(bytes)["word/document.xml"]);
  assert.ok(document.includes("Original unrelated experience remains."));
  assert.ok(document.includes("Unsafe proposed wording edits were omitted"));
  assert.equal(document.includes('w:highlight w:val="yellow"'), false);
  assert.equal(verifyWordDraft(bytes, "Tailored Resume Draft"), true);
});

test("the templates separate required and preferred matches and do not invent employer questions", () => {
  const checklist = buildDraftPlan(record, "RESUME_TAILORING_CHECKLIST");
  assert.ok(checklist.sections.some((section) => section.heading === "Required qualification evidence"));
  assert.ok(checklist.sections.some((section) => section.heading === "Preferred qualification evidence"));
  const worksheet = buildDraftPlan(record, "APPLICATION_QUESTION_WORKSHEET");
  assert.ok(worksheet.sections.some((section) => section.paragraphs?.some((item) => item.includes("No employer application-form questions have been verified"))));
  assert.ok(worksheet.placeholders.some((item) => item.includes("actual employer question")));
});

test("unsupported draft types and contact details cannot enter a generated document", () => {
  assert.throws(() => buildDraftPlan(record, "FULL_APPLICATION"));
  const withContact = { ...record, fitEvidence: { ...record.fitEvidence, requiredMatches: ["Email student@example.edu and call 415-555-0100"] } };
  const bytes = createWordDraft(buildDraftPlan(withContact, "RESUME_TAILORING_CHECKLIST"));
  const document = strFromU8(unzipSync(bytes)["word/document.xml"]);
  assert.equal(document.includes("student@example.edu"), false);
  assert.equal(document.includes("415-555-0100"), false);
  assert.equal(verifyWordDraft(new Uint8Array([1, 2]), "Resume Tailoring Checklist"), false);
});

test("Word metadata retains a valid creation timestamp instead of treating it as contact data", () => {
  const bytes = createWordDraft(buildDraftPlan(record, "RESUME_TAILORING_CHECKLIST"), "2026-09-29T19:43:34.346Z");
  const core = strFromU8(unzipSync(bytes)["docProps/core.xml"]);
  assert.ok(core.includes("2026-09-29T19:43:34.346Z"));
  assert.equal(core.includes("[contact detail omitted]"), false);
});
