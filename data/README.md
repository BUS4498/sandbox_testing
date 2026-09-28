# Local Runtime Data Area

## Purpose

The `data/` area documents the local persistence that the Internship Application Prep Agent needs. The implementation stores changing operational data under `data/local/` in the project folder. That runtime folder is excluded from Git.

## Opportunity spreadsheet

The application generates and maintains:

```text
data/local/internship_pipeline.xlsx
```

The spreadsheet will be the student's primary user-visible operational collection of tracked internship opportunities.

The spreadsheet is created locally with an empty collection when the application is initialized and is updated only through verified runtime actions.

## Runtime contents

Local runtime data may include:

- the internship spreadsheet;
- local agent state;
- operational memory or other runtime persistence;
- logs;
- temporary files; and
- locally prepared, review-only application templates;
- privately uploaded resume source files, editable extracted previews, and confirmed non-identifying agent-facing profiles;
- confirmed local preferred roles, availability, work-arrangement choices, geographic boundaries, and other student constraints;
- backups or recovery files needed for safe local operation.

The dashboard shows the resolved runtime folder and spreadsheet path so the student can find the files on the current device.

Student notification recipient and local schedule settings may be stored in this runtime area. The OpenAI API key and any future email-provider credentials must not be copied into runtime records. Application templates should be grouped by opportunity, saved as formatted Microsoft Word `.docx` files, labeled for student review, and never treated as submitted or final materials.

Private student setup data belongs under `data/local/student-profile/`. The original resume source file is retained locally for student inspection, while only an explicitly confirmed non-identifying profile may be supplied to the model. Confirmed preference-and-constraint records remain stable context in this private folder rather than operational memory. Uploading a resume or partially completing the setup form does not confirm it. Student setup contents must not be written to logs, spreadsheet rows, notification previews, reset summaries, or Git-tracked files.

The dashboard may provide a confirmed **Reset Collection** operation. A reset should archive the prior spreadsheet, opportunity-related memory, material drafts, and notification previews under a private Git-ignored reset archive before initializing the active collection again. It should preserve confirmed student setup, local notification settings, API configuration references, and local schedule information.

## Git boundary

Runtime files must not be committed to Git when they contain changing student information, application activity, local state, logs, credentials, or other personal operational data. The active `data/local/` location is covered by an explicit ignore rule.

The committed repository should contain design specifications and safe synthetic context—not a student's personal internship spreadsheet or operational history.

## Owner-only Codex Sites pilot

The optional hosted pilot does **not** reuse `data/local/` or copy its spreadsheet, resume, settings, memory, or archives. Its first checkpoint uses synthetic student context and manual collection. Current opportunities and operational history require separate private durable hosted storage; the user-facing `.xlsx` collection is generated from verified current records and offered as a timestamped download. A hosted `.xlsx` export must not be confused with the local authoritative file.

Hosted reset and real-resume storage remain unavailable until their private backup, consent, retention, and verification rules are implemented. Never include hosted runtime records, OAuth tokens, uploaded documents, or API keys in Git or a Site source archive. See [`runtime/codex-sites-private-pilot.md`](../runtime/codex-sites-private-pilot.md) for the hosted boundary.
