import { strToU8, unzipSync, zipSync } from "fflate";
import { isResumeSectionHeading } from "./resume-structure.js";
import { UNVERIFIED_LABEL } from "./material-draft-validation.js";

export const WORD_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
export const DRAFT_NOTICE = "DRAFT TEMPLATE — STUDENT REVIEW REQUIRED";
export const MATERIAL_TYPES = Object.freeze({
  TAILORED_RESUME: "Tailored Resume Draft",
  COVER_LETTER_DRAFT: "Cover Letter Draft",
  RESUME_TAILORING_CHECKLIST: "Resume Tailoring Checklist",
  COVER_LETTER_OUTLINE: "Cover Letter Outline",
  APPLICATION_QUESTION_WORKSHEET: "Application Question Worksheet",
});

/** @param {Record<string, any>} record @param {"TAILORED_RESUME"|"COVER_LETTER_DRAFT"} type @param {{resumeItems: {section:string,evidenceId:string}[],resumeEdits?:{evidenceId:string,revisedText:string}[],letterParagraphs:{text:string,evidenceIds:string[]}[],evidence:{id:string,text:string,sourceIndex?:number}[],resumeBaseline?:string[],preparationNotices?:Record<string,string>,verificationNotes?:Record<string,string[]>}} drafted */
export function buildRoleDraftPlan(record, type, drafted) {
  if (!["TAILORED_RESUME", "COVER_LETTER_DRAFT"].includes(type)) throw new TypeError("Choose a supported tailored draft type.");
  if (!record?.opportunityId || !record?.company || !record?.roleTitle) throw new TypeError("A tracked opportunity is required.");
  const evidence = new Map(drafted.evidence.map((item) => [item.id, item.text]));
  const resumeItems = drafted.resumeItems.map((item) => {
    const source = evidence.get(item.evidenceId);
    if (!source) throw new TypeError("A resume line is missing verified student evidence.");
    return { section: item.section, text: plain(source, 450), sourceId: item.evidenceId, highlight: false };
  });
  const editByIndex = new Map((drafted.resumeEdits ?? []).map((item) => {
    const source = drafted.evidence.find((entry) => entry.id === item.evidenceId);
    const index = Number.isInteger(source?.sourceIndex) ? source.sourceIndex : (drafted.resumeBaseline ?? []).indexOf(source?.text ?? "");
    return [index, item.revisedText];
  }).filter(([index]) => Number.isInteger(index) && index >= 0));
  const resumeContent = (drafted.resumeBaseline ?? []).map((line, index) => {
    const revised = editByIndex.get(index);
    const text = revised && line.startsWith("• ") && !revised.startsWith("• ") ? `• ${revised}` : revised ?? line;
    return { text: plain(text, 1_800), highlight: Boolean(revised) };
  }).filter((item) => item.text);
  const letterParagraphs = drafted.letterParagraphs.map((item) => plain(item.text, 1_000));
  const verificationNotes = (drafted.verificationNotes?.COVER_LETTER_DRAFT ?? []).map((item) => plain(item, 1_000));
  if (type === "TAILORED_RESUME" && resumeItems.length < 4) throw new TypeError("The tailored resume needs verified student content.");
  if (type === "COVER_LETTER_DRAFT" && letterParagraphs.length < 3) throw new TypeError("The cover letter needs complete draft paragraphs.");
  return {
    title: MATERIAL_TYPES[type], company: plain(record.company, 120), role: plain(record.roleTitle, 160),
    layout: type === "TAILORED_RESUME" ? "RESUME" : "COVER", resumeItems, resumeContent, letterParagraphs,
    sections: [], placeholders: ["Replace the name and contact placeholders with your own details.", "Review every proposed sentence and revise in your own voice before use.", ...verificationNotes],
    preparationNotice: plain(drafted.preparationNotices?.[type], 300), verificationNotes,
    evidenceMap: drafted.evidence.map((item) => ({ id: item.id, text: plain(item.text, 450) })),
    nextStep: "Download, verify every claim, add your contact details, and edit this draft before using it. Nothing was submitted or sent.",
  };
}

/** @param {unknown} value @param {number} [limit] */
function plain(value, limit = 600) {
  return String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, "[contact detail omitted]")
    .replace(/(?:\+?\d[\d .()-]{7,}\d)/g, "[contact detail omitted]")
    .replace(/\*\*|`/g, "")
    .replace(/\s+/g, " ").trim().slice(0, limit);
}

/** @param {unknown} value */
function xml(value) {
  return plain(value, 2_000).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

/** @param {unknown} values @param {number} [limit] */
function concise(values, limit = 5) {
  return Array.isArray(values) ? values.map((item) => plain(item)).filter(Boolean).slice(0, limit) : [];
}

/** A conservative, evidence-grounded outline; no application answer is invented. */
/** @param {Record<string, any>} record @param {string} type */
export function buildDraftPlan(record, type) {
  if (!Object.hasOwn(MATERIAL_TYPES, type)) throw new TypeError("Choose a supported Word draft type.");
  if (!record?.opportunityId || !record?.company || !record?.roleTitle || !record?.fitEvidence) throw new TypeError("A tracked opportunity with fit evidence is required.");
  const required = concise(record.fitEvidence.requiredMatches, 6);
  const preferred = concise(record.fitEvidence.preferredMatches, 4);
  const matches = concise([...required, ...preferred], 7);
  const gaps = concise(record.fitEvidence.gaps, 5);
  const unknowns = concise(record.fitEvidence.unknowns, 5);
  const company = plain(record.company, 120);
  const role = plain(record.roleTitle, 160);
  const source = plain(record.postingUrl, 500);
  const sections = [];
  const placeholders = [];
  if (type === "RESUME_TAILORING_CHECKLIST") {
    sections.push({ heading: "Required qualification evidence", bullets: required.length ? required.map((item) => `Review whether your resume accurately shows: ${item}`) : ["No required-qualification match is verified in this record. Review the posting before editing."] });
    sections.push({ heading: "Preferred qualification evidence", bullets: preferred.length ? preferred.map((item) => `Consider emphasizing if relevant and accurate: ${item}`) : ["No preferred-qualification match is verified in this record."] });
    sections.push({ heading: "Claims to check before editing", bullets: gaps.length ? gaps.map((item) => `Do not imply this is already established: ${item}`) : ["Check every proposed qualification against your verified resume and experience."] });
    placeholders.push(...unknowns.map((item) => `Confirm before using: ${item}`));
    placeholders.push("Choose which verified experience or project examples to emphasize in your own resume.");
  } else if (type === "COVER_LETTER_OUTLINE") {
    placeholders.push(`Write your own opening explaining why ${company} and this role interest you.`);
    sections.push({ heading: "Opening", paragraphs: [`[Student to write: why this ${role} opportunity is of interest. Do not claim facts not verified in the posting.]`] });
    sections.push({ heading: "Evidence for the body", bullets: matches.length ? [...required.map((item) => `Required match — consider a verified example supporting: ${item}`), ...preferred.map((item) => `Preferred match — consider a verified example supporting: ${item}`)] : ["Select a verified project, course, or work example that answers a stated role requirement."] });
    sections.push({ heading: "Closing", paragraphs: ["[Student to write: a short, genuine closing after checking the employer's current instructions.]"] });
    placeholders.push("Add specific examples and outcomes only after checking them against your own records.");
    placeholders.push(...unknowns.map((item) => `Clarify if relevant: ${item}`));
  } else {
    sections.push({ heading: "Before answering", paragraphs: ["No employer application-form questions have been verified from this collection record. Copy the actual questions from the employer's official application page into your own working copy before answering."] });
    sections.push({ heading: "Verified evidence you may draw on", bullets: matches.length ? [...required.map((item) => `Required match: ${item}`), ...preferred.map((item) => `Preferred match: ${item}`)] : ["Review your verified education, projects, and experience before drafting an answer."] });
    sections.push({ heading: "Planning prompts — not employer questions", bullets: ["Which verified project or work example best demonstrates the required skills?", "Can you meet the role's stated internship dates and work arrangement?", "Which qualification gaps need an honest explanation or clarification?"] });
    placeholders.push("Paste each actual employer question and draft your own answer in a separate copy.");
    placeholders.push(...unknowns.map((item) => `Resolve before answering if requested: ${item}`));
  }
  if (gaps.length && type !== "RESUME_TAILORING_CHECKLIST") sections.push({ heading: "Gaps to handle honestly", bullets: gaps.map((item) => `Do not imply this is verified: ${item}`) });
  sections.push({ heading: "Source and review", paragraphs: [`Opportunity: ${company} — ${role}.`, `Posting source: ${source || "Unavailable; verify before using this draft."}`, `Assessment profile: ${record.assessmentProfileMode === "REAL" ? "confirmed real-student setup" : "synthetic demonstration setup"}.`, "This document is a preparation aid only. Review every claim, fill the blanks, and follow the employer's current instructions yourself. Nothing has been submitted or sent."] });
  return { title: MATERIAL_TYPES[type], company, role, sections, placeholders: concise(placeholders, 12), nextStep: "Review and edit this Word draft yourself before using any part of it in an application." };
}

function paragraph(value, style = "Normal", list = false) {
  const prop = `<w:pPr><w:pStyle w:val="${style}"/>${list ? '<w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr>' : ""}</w:pPr>`;
  return `<w:p>${prop}<w:r><w:t xml:space="preserve">${xml(value)}</w:t></w:r></w:p>`;
}

function styledParagraph(value, style, highlight = false) {
  const keepTogether = style === "ResumeSection" ? "<w:keepNext/><w:keepLines/>" : ["ResumeEntry", "ResumeBullet"].includes(style) ? "<w:keepLines/>" : "";
  return `<w:p><w:pPr><w:pStyle w:val="${style}"/>${keepTogether}</w:pPr><w:r><w:rPr>${highlight ? '<w:highlight w:val="yellow"/>' : ""}</w:rPr><w:t xml:space="preserve">${xml(value)}</w:t></w:r></w:p>`;
}

function tailoredBody(plan) {
  if (plan.layout === "RESUME") {
    const body = [
      styledParagraph("[Your name]", "ResumeName"),
      styledParagraph("[Your phone]  •  [Your email]  •  [Your professional link]", "ResumeContact"),
      styledParagraph(plan.title + " — " + DRAFT_NOTICE, "ResumeNotice"),
      styledParagraph("The confirmed resume text is retained below in its original order. Only proposed wording changes are highlighted; verify every claim.", "ResumeNotice"),
    ];
    if (plan.resumeContent?.length) {
      for (const [index, item] of plan.resumeContent.entries()) {
        const heading = isResumeSectionHeading(item.text);
        const bullet = item.text.startsWith("• ");
        const nextIsBullet = plan.resumeContent[index + 1]?.text.startsWith("• ");
        const style = heading ? "ResumeSection" : bullet ? "ResumeBullet" : item.text.length < 180 && nextIsBullet ? "ResumeEntry" : "ResumeBody";
        body.push(styledParagraph(item.text, style, item.highlight));
      }
      body.push(styledParagraph("Student review required — confirm highlighted emphasis, fill contact details, and edit before use.", "ResumeNotice"));
      if (plan.preparationNotice) body.push(styledParagraph(plan.preparationNotice, "ResumeNotice"));
      return body;
    }
    const labels = { EDUCATION: "EDUCATION", EXPERIENCE: "WORK EXPERIENCE", PROJECTS: "PROJECTS & LEADERSHIP", SKILLS: "SKILLS & HONORS" };
    for (const section of ["EDUCATION", "EXPERIENCE", "PROJECTS", "SKILLS"]) {
      const items = plan.resumeItems.filter((item) => item.section === section);
      if (!items.length) continue;
      body.push(styledParagraph(labels[section], "ResumeSection"));
      for (const item of items) body.push(styledParagraph(`•  ${item.text}`, "ResumeBullet", item.highlight));
    }
    body.push(styledParagraph("Student review required — verify highlighted emphasis and add your own contact details before use.", "ResumeNotice"));
    if (plan.preparationNotice) body.push(styledParagraph(plan.preparationNotice, "ResumeNotice"));
    return body;
  }
  const body = [
    styledParagraph("CAL POLY-INSPIRED APPLICATION DRAFT", "LetterBrand"),
    styledParagraph("[Your name]", "LetterName"),
    styledParagraph("[Your email]  •  [Your phone]  •  [Your location]", "LetterContact"),
    styledParagraph(plan.title + " — " + DRAFT_NOTICE, "LetterNotice"),
    styledParagraph("[Date]", "LetterNormal"),
    styledParagraph("Hiring Team", "LetterNormal"),
    styledParagraph(plan.company, "LetterNormal"),
    styledParagraph(`Re: ${plan.role}`, "LetterSubject"),
    styledParagraph("Dear Hiring Team,", "LetterNormal"),
    ...plan.letterParagraphs.map((item) => styledParagraph(item, item.startsWith(UNVERIFIED_LABEL) ? "LetterUnverified" : "LetterNormal")),
    styledParagraph("Sincerely,", "LetterNormal"),
    styledParagraph("[Your name]", "LetterNormal"),
  ];
  if (plan.verificationNotes?.length) {
    body.push(styledParagraph("STUDENT VERIFICATION NOTES — NOT PART OF THE COVER LETTER", "LetterReviewHeading"));
    body.push(styledParagraph("Student review required — verify every claim and replace placeholders before use. Nothing was sent or submitted.", "LetterReviewNote"));
    body.push(styledParagraph("Do not use the marked paragraphs as final claims. Confirm each statement against your original resume, then remove its UNVERIFIED label or delete the unsupported wording before use.", "LetterReviewNote"));
    for (const note of plan.verificationNotes) body.push(styledParagraph(note, "LetterReviewNote"));
  } else {
    body.push(styledParagraph("Student review required — verify every claim and replace placeholders before use. Nothing was sent or submitted.", "LetterNotice"));
  }
  return body;
}

/** @param {ReturnType<typeof buildDraftPlan>} plan @param {string} createdAt */
export function createWordDraft(plan, createdAt = new Date().toISOString()) {
  const createdDate = new Date(createdAt);
  const createdTimestamp = Number.isFinite(createdDate.getTime()) ? createdDate.toISOString() : new Date().toISOString();
  const body = plan.layout ? tailoredBody(plan) : [paragraph(plan.title, "Title"), paragraph(`${plan.company} — ${plan.role}`, "Subtitle"), paragraph(DRAFT_NOTICE, "Notice"), paragraph("Use this outline to prepare and review your own application materials. It is not a final document or a submitted application.")];
  if (!plan.layout) {
  for (const section of plan.sections) {
    body.push(paragraph(section.heading, "Heading1"));
    for (const item of section.paragraphs ?? []) body.push(paragraph(item));
    for (const item of section.bullets ?? []) body.push(paragraph(item, "Normal", true));
  }
  if (plan.includeChecklist !== false) {
    body.push(paragraph("Student review checklist", "Heading1"));
    for (const item of plan.placeholders) body.push(paragraph(`[Student to complete] ${item}`, "Placeholder", true));
    for (const item of ["Verify every qualification and outcome against your own records.", "Revise the wording in your own voice and check the employer's current instructions.", "Nothing has been submitted or sent."]) body.push(paragraph(item, "Normal", true));
  }
  }
  const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body.join("")}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1350" w:right="1350" w:bottom="1350" w:left="1350"/></w:sectPr></w:body></w:document>`;
  const style = (id, opts = "") => `<w:style w:type="paragraph" w:styleId="${id}"${id === "Normal" ? ' w:default="1"' : ""}><w:name w:val="${id}"/>${id === "Normal" ? "" : '<w:basedOn w:val="Normal"/>'}${opts}</w:style>`;
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="22"/><w:color w:val="172F35"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="140" w:line="290" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>${style("Normal")}${style("Title",'<w:rPr><w:b/><w:sz w:val="36"/></w:rPr>')}${style("Subtitle")}${style("Heading1",'<w:rPr><w:b/><w:sz w:val="27"/></w:rPr>')}${style("Notice",'<w:rPr><w:b/></w:rPr>')}${style("Placeholder",'<w:rPr><w:i/></w:rPr>')}${style("ResumeName",'<w:pPr><w:jc w:val="center"/><w:spacing w:after="35"/></w:pPr><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:b/><w:sz w:val="28"/><w:color w:val="000000"/></w:rPr>')}${style("ResumeContact",'<w:pPr><w:jc w:val="center"/><w:spacing w:after="130"/></w:pPr><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:sz w:val="19"/><w:color w:val="000000"/></w:rPr>')}${style("ResumeSection",'<w:pPr><w:spacing w:before="170" w:after="55"/><w:pBdr><w:bottom w:val="single" w:sz="5" w:color="000000"/></w:pBdr></w:pPr><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:b/><w:sz w:val="21"/><w:color w:val="000000"/></w:rPr>')}${style("ResumeEntry",'<w:pPr><w:spacing w:before="65" w:after="35"/></w:pPr><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:b/><w:sz w:val="19"/><w:color w:val="000000"/></w:rPr>')}${style("ResumeBody",'<w:pPr><w:spacing w:after="65"/></w:pPr><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:sz w:val="19"/><w:color w:val="000000"/></w:rPr>')}${style("ResumeBullet",'<w:pPr><w:spacing w:after="45"/><w:ind w:left="300" w:hanging="180"/></w:pPr><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:sz w:val="19"/><w:color w:val="000000"/></w:rPr>')}${style("ResumeNotice",'<w:pPr><w:spacing w:after="70"/></w:pPr><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:i/><w:sz w:val="16"/><w:color w:val="555555"/></w:rPr>')}${style("LetterBrand",'<w:pPr><w:spacing w:after="100"/><w:pBdr><w:bottom w:val="single" w:sz="10" w:color="BD8B13"/></w:pBdr></w:pPr><w:rPr><w:b/><w:sz w:val="18"/><w:color w:val="154734"/></w:rPr>')}${style("LetterName",'<w:pPr><w:spacing w:after="40"/></w:pPr><w:rPr><w:b/><w:sz w:val="28"/><w:color w:val="154734"/></w:rPr>')}${style("LetterContact",'<w:pPr><w:spacing w:after="180"/></w:pPr><w:rPr><w:sz w:val="19"/><w:color w:val="48545A"/></w:rPr>')}${style("LetterSubject",'<w:pPr><w:spacing w:before="100" w:after="140"/></w:pPr><w:rPr><w:b/><w:sz w:val="22"/><w:color w:val="154734"/></w:rPr>')}${style("LetterNormal",'<w:pPr><w:spacing w:after="165" w:line="310" w:lineRule="auto"/></w:pPr><w:rPr><w:sz w:val="21"/><w:color w:val="000000"/></w:rPr>')}${style("LetterNotice",'<w:pPr><w:spacing w:before="100" w:after="110"/></w:pPr><w:rPr><w:i/><w:sz w:val="17"/><w:color w:val="6B5A27"/></w:rPr>')}${style("LetterUnverified",'<w:pPr><w:spacing w:before="120" w:after="165" w:line="310" w:lineRule="auto"/><w:shd w:fill="FFF0C2"/></w:pPr><w:rPr><w:b/><w:sz w:val="21"/><w:color w:val="6F3D00"/></w:rPr>')}${style("LetterReviewHeading",'<w:pPr><w:pageBreakBefore/><w:spacing w:after="130"/></w:pPr><w:rPr><w:b/><w:sz w:val="22"/><w:color w:val="000000"/></w:rPr>')}${style("LetterReviewNote",'<w:pPr><w:spacing w:after="130" w:line="290" w:lineRule="auto"/></w:pPr><w:rPr><w:sz w:val="20"/><w:color w:val="000000"/></w:rPr>')}</w:styles>`;
  // Word enforces OOXML child order more strictly than ZIP/XML readers do.
  const wordCompatibleStyles = styles
    .replace(/(<w:sz\b[^>]*\/>)(<w:color\b[^>]*\/>)/g, "$2$1")
    .replace(/(<w:jc\b[^>]*\/>)(<w:spacing\b[^>]*\/>)/g, "$2$1")
    .replace(/(<w:spacing\b[^>]*\/>)(<w:pBdr>[\s\S]*?<\/w:pBdr>)/g, "$2$1")
    .replace(/(<w:spacing\b[^>]*\/>)(<w:shd\b[^>]*\/>)/g, "$2$1")
    .replace(/<w:shd w:fill="([^"]+)"\/>/g, '<w:shd w:val="clear" w:color="auto" w:fill="$1"/>');
  const numbering = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:abstractNum w:abstractNumId="0"><w:multiLevelType w:val="singleLevel"/><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/><w:lvlJc w:val="left"/><w:pPr><w:tabs><w:tab w:val="num" w:pos="540"/></w:tabs><w:ind w:left="540" w:hanging="260"/></w:pPr></w:lvl></w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num></w:numbering>`;
  const files = {
    "[Content_Types].xml": strToU8(`<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>`),
    "_rels/.rels": strToU8(`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`),
    "word/document.xml": strToU8(document),
    "word/_rels/document.xml.rels": strToU8(`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/></Relationships>`),
    "word/styles.xml": strToU8(wordCompatibleStyles),
    "word/numbering.xml": strToU8(numbering),
    "docProps/core.xml": strToU8(`<?xml version="1.0" encoding="UTF-8"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${xml(plan.title)}</dc:title><dc:creator>Internship Application Prep Agent</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${createdTimestamp}</dcterms:created></cp:coreProperties>`),
  };
  return zipSync(files, { level: 6 });
}

/** @param {Uint8Array} bytes @param {string} expectedTitle */
export function verifyWordDraft(bytes, expectedTitle) {
  if (!(bytes instanceof Uint8Array) || bytes.length < 1_000) return false;
  try {
    const files = unzipSync(bytes);
    const document = files["word/document.xml"] && new TextDecoder().decode(files["word/document.xml"]);
    return Boolean(files["[Content_Types].xml"] && files["word/styles.xml"] && files["word/numbering.xml"] && document?.includes(xml(expectedTitle)) && document.includes(xml(DRAFT_NOTICE)));
  } catch { return false; }
}
