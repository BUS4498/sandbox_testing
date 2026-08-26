---
name: application-material-prep
description: Prepare evidence-grounded, review-only internship application templates for a tracked opportunity. Use when a student requests a resume-tailoring checklist, cover-letter outline, or application-question worksheet. Never finalize or submit materials.
metadata:
  short-description: Review-only application template preparation
---

# Application Material Preparation

Prepare useful application-template content from the selected posting and verified student context. The output supports the student's own review and writing; it is not a completed application and must remain clearly labeled as a draft template.

## Required inputs

- A tracked opportunity and current posting evidence.
- The student's explicit preparation request.
- Only the relevant verified education, skills, coursework, projects, and experience from `context/`.
- Current decision, next action, deadline, and known qualification gaps.
- Requested template types.

If essential information is missing, create a visible placeholder or return a precise student question. Never invent an answer.

## Instructions

1. Identify the employer's observable application requirements without opening, completing, or submitting an application form.
2. Select only verified student evidence relevant to the role.
3. Preserve the difference between a posting requirement, a verified student fact, a suggested emphasis, and a student-supplied response.
4. Prepare only the requested template types:
   - a resume-tailoring checklist that proposes review points without changing the authoritative resume;
   - a cover-letter outline with factual evidence prompts and visible placeholders; or
   - an application-question worksheet that lists known questions, verified evidence, and fields the student must answer.
5. Use concise, student-editable language and label every artifact `DRAFT TEMPLATE — STUDENT REVIEW REQUIRED`.
6. Explain which verified evidence supports each suggested point.
7. Identify genuine gaps and unresolved questions transparently.
8. End with the exact student review step required before any material could become final.
9. Organize the content into a Word-ready hierarchy of title, short purpose statement, headings, paragraphs, real list items, evidence references, visible placeholders, and a final review checklist. Do not depend on raw Markdown formatting as the delivered student experience.

## Output contract

Return:

- opportunity ID;
- requested template types;
- one or more draft-template records containing type, title, Word-ready structured content, evidence references, placeholders, and unresolved questions; the local controller may receive a safe Markdown-like intermediate, but the saved and downloadable artifact must be a formatted `.docx` file;
- concise preparation rationale;
- exact next student review step; and
- a confirmation that nothing was submitted or sent.

## Boundaries

Do not fabricate qualifications, rewrite the authoritative resume, represent a draft as final, answer legal or eligibility questions without verified information, visit or complete an application form, upload a file, send a material, contact an employer, or submit an application.
