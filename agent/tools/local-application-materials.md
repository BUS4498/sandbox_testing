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
- Template title, type, and Markdown content.
- Visible placeholders and unresolved questions.
- Run ID, creation time, and idempotency key.

Supported initial template types may include:

- `RESUME_TAILORING_CHECKLIST`;
- `COVER_LETTER_OUTLINE`; and
- `APPLICATION_QUESTION_WORKSHEET`.

## Expected output

For each saved template, return a stable material ID, opportunity ID, template type, safe local path, creation time, verification result, and status such as `DRAFT TEMPLATE — STUDENT REVIEW REQUIRED`.

Templates should be stored in a private local runtime location grouped by opportunity. The dashboard should let the student inspect or download them without exposing unrelated runtime files.

## Permissions

The tool may create and update local draft-template files and verify that the intended content was saved. It may not alter an authoritative resume, mark a template as final, upload a material, fill or submit an employer form, or send a material to an employer.

## Failure behavior

If preparation content is unsupported, incomplete, unsafe, or cannot be saved and verified, return a failure or partial result and preserve the exact unresolved question. Do not silently replace missing facts with favorable language.

## Security considerations

- Store templates under `data/local/application-materials/`, which is excluded from Git.
- Use safe generated file names rather than company- or student-supplied paths.
- Do not store credentials, legal identifiers, or unnecessary sensitive data.
- Treat all templates as untrusted draft text when rendered in the browser.
- Serve or download only a specifically requested material belonging to the selected opportunity.
