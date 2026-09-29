---
name: application-material-prep
description: Prepare evidence-grounded, review-only internship application drafts for a tracked opportunity. Use when a student requests a tailored resume, full cover letter, or application-question worksheet. Never finalize or submit materials.
metadata:
  short-description: Review-only application template preparation
---

# Application Material Preparation

Prepare substantive, editable application drafts from the selected posting and verified student context. These are student-review drafts, not final or submitted application materials.

## Required inputs

- A tracked opportunity with source-backed responsibilities and required/preferred qualifications when available. If an older record lacks them, refresh the public posting or label the gap; do not infer duties from the role title.
- The student's confirmed resume text as the complete drafting baseline and, when separately approved for private retention, the original resume file as an owner-downloadable comparison reference. The current hosted renderer need not duplicate a PDF's visual layout.
- The student's explicit preparation request.
- Only the relevant verified education, skills, coursework, projects, and experience from `context/`.
- Current decision, next action, deadline, and known qualification gaps.
- Requested template types.

If essential information is missing, create a visible placeholder or return a precise student question. Never invent an answer.

## Instructions

1. Identify the employer's observable application requirements without opening, completing, or submitting an application form.
2. Preserve the full confirmed resume content as the baseline. Select verified role-relevant evidence for emphasis, not as a reason to discard other original education, experience, project, or skill content.
3. Preserve the difference between a posting requirement, a verified student fact, a suggested emphasis, and a student-supplied response.
4. Prepare only the requested template types:
   - a tailored resume draft that retains the original resume's substantive content and section structure, integrates only verified role-relevant edits in place, and highlights each proposed change for student review; do not replace the resume with a short excerpt list;
   - a complete, role-specific cover-letter draft in a restrained Cal Poly-inspired style, with substantive opening, evidence-backed body, and closing; or
   - an application-question worksheet that lists known questions, verified evidence, and fields the student must answer.
   A privately retained original resume belongs only to the student who uploaded it. Use it solely for that student's draft; never copy its identity or claims into another student's materials, and never send the original file to a model. If a PDF cannot preserve editable Word formatting, retain all readable confirmed content in a new Word layout and disclose that limitation. Do not present the cover letter as official Cal Poly correspondence.
5. Use concise, student-editable language and label every artifact `DRAFT TEMPLATE — STUDENT REVIEW REQUIRED`.
6. Trace every proposed resume change and cover-letter example to verified student evidence and a specific posting responsibility or qualification when one is available. Preserve unchanged resume text, including less role-relevant items. Clarify verified wording without inventing facts, metrics, titles, or dates. If evidence is insufficient for a substantive draft, return a precise gap instead of a generic outline labeled as a finished draft.
7. Identify genuine gaps and unresolved questions transparently.
8. End with the exact student review step required before any material could become final.
9. Organize content into Word-ready structured sections, paragraphs, evidence references, changed-text markers, and visible placeholders. The resume and cover letter must read as actual editable drafts; keep review instructions separate from the application-facing body. Do not depend on raw Markdown formatting as the delivered student experience.

## Output contract

Return:

- opportunity ID;
- requested template types;
- one or more draft-template records containing type, title, Word-ready structured content, evidence references, placeholders, and unresolved questions; the local controller may receive a safe Markdown-like intermediate, but the saved and downloadable artifact must be a formatted `.docx` file;
- concise preparation rationale;
- exact next student review step; and
- a confirmation that nothing was submitted or sent.

## Boundaries

Do not fabricate qualifications, overwrite the authoritative resume, represent a draft as final, answer legal or eligibility questions without verified information, visit or complete an application form, upload a file to an employer, send a material, contact an employer, or submit an application. Send only relevant confirmed, non-identifying profile excerpts and public posting facts to the configured OpenAI API when model drafting is used; never send the original resume file or contact details. Keep any retained original resume private, owner-scoped, and deletable.
