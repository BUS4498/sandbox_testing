# Local runtime data

No spreadsheet or runtime database is included in this repository.

## Intended location

The future application must generate its internship spreadsheet inside an operating-system-appropriate application-data directory outside the Git checkout, for example:

```text
<student-app-data>/internship-application-operations-agent/internships.xlsx
```

The exact location should be resolved by the future runtime and shown in the local dashboard. The student may choose another local folder. The application must reject a configured location inside the repository unless the student explicitly changes the design and accepts the exposure risk.

## Planned spreadsheet role

The spreadsheet is a human-readable synchronized view of the agent's current internship collection, not a hidden source of truth. At minimum, a future workbook should expose stable opportunity identifiers, organization, title, source URL, location, work mode, eligibility, deadline, status, fit label, confidence, next action, last verified time, and last material change.

Writes must be atomic where practical, preserve a recoverable backup, and be verified by reopening the file and checking the intended records. Duplicate rows must be prevented through stable identifiers and the rules in [`../agent/policy-and-rules/duplicate-prevention.md`](../agent/policy-and-rules/duplicate-prevention.md).

## Data handling

- Never commit generated spreadsheets, runtime memory, logs containing personal data, or credentials.
- Minimize personal information in the tracker.
- Record source and observation timestamps for facts that can become stale.
- Distinguish empty, unknown, not applicable, and not yet verified values.
- Provide export and deletion controls in the future local application.

