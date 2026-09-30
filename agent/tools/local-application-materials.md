# Local Application Materials Tool Specification

## Tool name

**Local Application Materials**

## Purpose

Save, list, retrieve, and verify reviewable internship-application Word drafts prepared for a specific opportunity. These artifacts support student preparation; they are not final application materials and they cannot submit an application.

## When the agent may use it

The agent may use this tool after the student requests preparation help or a current decision recommends `PREPARE`. The applicable opportunity must already exist in the local collection, and the preparation content must follow the `application-material-prep` Skill.

## Required inputs

- Opportunity ID, company, and role title.
- Student request and requested template types.
- Verified posting and student-context evidence references.
- Draft title, type, and Word-ready structured content, with evidence references and changed-text markers for a tailored resume. A safe Markdown-like structure may be accepted as an internal transport format, but it must not be retained or presented as the student-facing artifact.
- Visible placeholders and unresolved questions.
- Run ID, creation time, and idempotency key.

Supported initial template types may include:

- `TAILORED_RESUME`;
- `COVER_LETTER_DRAFT`; and
- `APPLICATION_QUESTION_WORKSHEET`.

Legacy checklist and outline documents remain downloadable under their original labels; new requests use the new types. The tailored resume follows the supplied PDF's layout only, never its personal data. Include editable name/contact placeholders, original verified wording where preserved, and visible highlighting for proposed changes or emphasis. The Cal Poly-inspired cover letter must be a complete letter, not an outline, and must not imply official university endorsement.

An independently requested interview-practice document may use this private Word storage and download capability, but it is **not** an automatic application-template choice. Its question and process sections, source labels, URLs, search date, opportunity version, and generated-versus-reported distinction must survive save and read-back verification. The separate **Practice Interview** control and tool specification govern when it can be prepared.

## Expected output

For each saved template, return a stable material ID, opportunity ID, template type, safe local `.docx` path, Word document MIME type, creation time, verification result, and status such as `DRAFT TEMPLATE — STUDENT REVIEW REQUIRED`.

Drafts should be stored as professionally formatted Microsoft Word `.docx` files in a private local runtime location grouped by opportunity. A tailored resume should be editable, preserve the reference resume's compact business-document hierarchy, retain every readable confirmed line, separate section headings and bullets even when PDF extraction runs them together, and highlight actual proposed changes rather than entire unchanged blocks. A cover letter should use restrained Cal Poly-inspired colors and a complete letter structure. When a student-claim paragraph lacks an evidence citation but the rest of the letter is substantively supported, retain that wording only with a prominent **UNVERIFIED — STUDENT MUST VERIFY** label in the letter and a separate, clearly non-letter verification note; never present it as an established fact. Put the review notice and unresolved placeholders where they do not masquerade as application-ready prose. Keep an evidence map and version in private metadata, and let the student download only the selected draft.

In the owner-only Sites pilot, this capability belongs to a later hosted feature group. Until a protected hosted artifact store and readable `.docx` download are verified, the dashboard must label hosted preparation **Not available in this pilot** and must not return a fabricated file path or success status. The local implementation remains available unchanged.

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
