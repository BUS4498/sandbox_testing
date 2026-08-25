# Future Local Runtime Data Area

## Purpose

The `data/` area documents the local persistence that a future Internship Application Operations Agent will need. During the later implementation phase, the application should keep changing operational data on the student's computer rather than in the committed repository.

## Future spreadsheet

The eventual application should generate and maintain a local spreadsheet such as:

```text
internship_pipeline.xlsx
```

The spreadsheet will be the student's primary user-visible operational collection of tracked internship opportunities.

**Do not create the spreadsheet during this specification phase.**

## Possible runtime contents

Future local runtime data may include:

- the internship spreadsheet;
- local agent state;
- operational memory or other runtime persistence;
- logs;
- temporary files; and
- backups or recovery files needed for safe local operation.

The exact storage layout should be selected during implementation and shown clearly in the local dashboard.

## Git boundary

Runtime files should not be committed to Git when they contain changing student information, application activity, local state, logs, credentials, or other personal operational data. The future runtime location should be outside the Git checkout or covered by explicit ignore rules.

The committed repository should contain design specifications and safe synthetic context—not a student's personal internship spreadsheet or operational history.
