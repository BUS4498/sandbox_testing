# Local Application Materials Tool Specification

## Tool name

**Local Application Materials**

## Purpose

Save, list, retrieve, and verify reviewable internship-application templates prepared for a specific opportunity. These artifacts support student preparation; they are not final application materials and they cannot submit an application.

## When the agent may use it

The agent may use this tool after the student requests preparation help or a current decision recommends `PREPARE`. The applicable opportunity must already exist in the local collection, and the preparation content must follow the `application-material-prep` Skill.

## Required inputs

- Opportunity ID, company, and role title.
- Student request and requested template types.
- Verified posting and student-context evidence references.
- Template title, type, and Word-ready structured content. A safe Markdown-like structure may be accepted as an internal transport format, but it must not be retained or presented as the student-facing artifact.
- Visible placeholders and unresolved questions.
- Run ID, creation time, and idempotency key.

Supported initial template types may include:

- `RESUME_TAILORING_CHECKLIST`;
- `COVER_LETTER_OUTLINE`; and
- `APPLICATION_QUESTION_WORKSHEET`.

## Expected output

For each saved template, return a stable material ID, opportunity ID, template type, safe local `.docx` path, Word document MIME type, creation time, verification result, and status such as `DRAFT TEMPLATE — STUDENT REVIEW REQUIRED`.

Templates should be stored as professionally formatted Microsoft Word `.docx` files in a private local runtime location grouped by opportunity. Each document should use a consistent business-document style, readable headings, real Word lists, a visible draft-review notice, opportunity identification, unresolved placeholders, and a student-review next step. Metadata may be stored in a separate private sidecar file. The dashboard should let the student download the Word draft without exposing unrelated runtime files.

## Permissions

The tool may create and update local Word draft-template files and verify that each result is a readable `.docx` package containing the intended draft label and content. It may not alter an authoritative resume, mark a template as final, upload a material, fill or submit an employer form, or send a material to an employer.

## Failure behavior

If preparation content is unsupported, incomplete, unsafe, or cannot be saved and verified, return a failure or partial result and preserve the exact unresolved question. Do not silently replace missing facts with favorable language.

## Security considerations

- Store templates under `data/local/application-materials/`, which is excluded from Git.
- Use safe generated file names rather than company- or student-supplied paths.
- Do not store credentials, legal identifiers, or unnecessary sensitive data.
- Escape or neutralize imported posting text before inserting it into Word documents.
- Do not retain a separate Markdown draft after the Word document has been created successfully.
- Serve or download only a specifically requested material belonging to the selected opportunity.
