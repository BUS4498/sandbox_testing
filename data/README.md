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
- backups or recovery files needed for safe local operation.

The dashboard shows the resolved runtime folder and spreadsheet path so the student can find the files on the current device.

Student notification recipient settings may be stored locally in this runtime area. Outlook authentication remains managed by Codex and must not be copied into runtime files. Application templates should be grouped by opportunity, saved as formatted Microsoft Word `.docx` files, labeled for student review, and never treated as submitted or final materials.

The dashboard may provide a confirmed **Reset Collection** operation. A reset should archive the prior spreadsheet, opportunity-related memory, material drafts, and notification previews under a private Git-ignored reset archive before initializing the active collection again. It should preserve local notification settings and Codex-managed authentication and schedule information.

## Git boundary

Runtime files must not be committed to Git when they contain changing student information, application activity, local state, logs, credentials, or other personal operational data. The active `data/local/` location is covered by an explicit ignore rule.

The committed repository should contain design specifications and safe synthetic context—not a student's personal internship spreadsheet or operational history.
