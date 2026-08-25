# Local Spreadsheet Tracker Tool Specification

## Tool name

**Local Spreadsheet Tracker**

## Purpose

Maintain the student's primary user-visible operational collection of internship opportunities in a local spreadsheet such as `internship_pipeline.xlsx`. Detailed process history remains in operational memory. No spreadsheet is created during this specification phase.

## When the agent may use it

The agent may use this tool to read current records, check for duplicates, add a valid new opportunity, update a materially changed opportunity, or verify a prior write.

## Required inputs

- Local spreadsheet path outside the Git repository.
- Operation: read, add, update, duplicate check, or verify.
- Stable opportunity ID and current expected record version when applicable.
- Intended field values and their ownership.
- Run ID, action ID, and idempotency key.

## Expected output

The future spreadsheet should contain one row per distinct opportunity and, at minimum, these fields:

| Field | Primary maintainer |
|---|---|
| Opportunity ID | Agent; stable and immutable |
| Date added | Agent |
| Last updated | Agent |
| Company | Agent from posting evidence |
| Role title | Agent from posting evidence |
| Location | Agent from posting evidence |
| Work arrangement | Agent from posting evidence |
| Deadline | Agent from posting evidence; uncertainty preserved |
| Posting URL | Agent |
| Posting status | Agent from current observation |
| Fit assessment | Agent recommendation |
| Agent decision | Agent |
| Decision rationale | Agent |
| Application status | Student-owned; agent changes only under a clear approved rule |
| Next action | Agent recommendation; student may override |
| Next-action date | Agent recommendation; student may override |
| Unresolved issue | Agent or student, with source identified |
| Last agent review | Agent |

A future workbook may also include a student-owned notes field. The tool returns the affected opportunity ID, prior and resulting values, record version, duplicate-check result, and read-back verification result.

## Permissions

The tool may read records, add records, update agent-maintained fields, check duplicates, and verify updates. It must not overwrite explicit student-owned application status, notes, overrides, or corrections without a clear rule or student approval.

## Failure behavior

If the file is missing, locked, corrupted, has an incompatible schema, conflicts with a newer version, or fails read-back verification, return `FAILURE` or `PARTIAL SUCCESS` with the affected fields. Do not send a related update email. Ambiguous duplicates must be flagged rather than merged automatically.

## Security considerations

Store the workbook in a local runtime data location excluded from Git. Use least-privilege file access, safe writes and recoverable backups, spreadsheet-safe text handling, and no embedded credentials. Avoid storing unnecessary personal data.
