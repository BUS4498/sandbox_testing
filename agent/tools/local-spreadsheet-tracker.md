# Local Spreadsheet Tracker Tool Specification

## Tool name

**Local Spreadsheet Tracker**

## Purpose

Maintain the student's primary user-visible operational collection of student-supplied and web-discovered internship opportunities in a local spreadsheet such as `internship_pipeline.xlsx`. Detailed process history remains in operational memory. No spreadsheet is created during this specification phase.

## When the agent may use it

The agent may use this tool to read current records, check for duplicates, add a valid new opportunity, update a materially changed opportunity, refresh permitted source-verification metadata, or verify a prior write.

## Required inputs

- Local spreadsheet path outside the Git repository.
- Operation: read, add, update, duplicate check, or verify.
- Stable opportunity ID and current expected record version when applicable.
- Intended field values and their ownership.
- Source, source/posting URL, discovery date, verification date, and posting status when available.
- Run ID, action ID, and idempotency key.

## Expected output

The future spreadsheet should contain **one current row per distinct opportunity**, including when the same opportunity is discovered through multiple searches, runs, or sources. Records must support web discovery and later source verification through `Source`, `Source/posting URL`, `Date discovered`, `Last verified date`, and `Posting status` fields.

At minimum, the collection should contain these fields:

| Field | Primary maintainer |
|---|---|
| Opportunity ID | Agent; stable and immutable |
| Date added | Agent |
| Date discovered | Agent; first date the opportunity was observed through an approved input or web discovery |
| Last updated | Agent |
| Last verified date | Agent; latest date on which the underlying posting or source was checked |
| Company | Agent from posting evidence |
| Role title | Agent from posting evidence |
| Location | Agent from posting evidence |
| Work arrangement | Agent from posting evidence |
| Deadline | Agent from posting evidence; uncertainty preserved |
| Source | Agent; current authoritative or best available posting source |
| Source/posting URL | Agent; original or canonical posting URL used to verify the opportunity |
| Application URL | Agent; direct application destination when separately available, otherwise the posting URL may serve as the application link |
| Posting status | Agent from current observation; `ACTIVE`, `CLOSED`, or `UNCERTAIN` |
| Fit assessment | Agent recommendation |
| Agent decision | Agent |
| Decision rationale | Agent |
| Application status | Student-owned; agent changes only under a clear approved rule |
| Next action | Agent recommendation; student may override |
| Next-action date | Agent recommendation; student may override |
| Unresolved issue | Agent or student, with source identified |
| Last agent review | Agent |
| Student notes | Student-owned; may include a locally submitted clarification or completion note |

A future workbook may also include a student-owned notes field. When a source is inaccessible or cannot be verified, the spreadsheet should use `UNCERTAIN` unless reliable evidence establishes another status. Inaccessibility alone must not be represented as `CLOSED`.

Refreshing the last verified date does not by itself make an otherwise unchanged posting a material update and must not trigger a material-update notification.

The tool returns the affected opportunity ID, prior and resulting values, record version, duplicate-check result, source metadata, and read-back verification result.

## Collection and history boundary

The spreadsheet represents the current user-facing internship collection, with one current row per distinct opportunity. It must not become a detailed execution log or create additional rows for repeated searches, source checks, decisions, actions, or notification attempts concerning the same opportunity.

Detailed historical observations, decisions, actions, verification results, and evaluations belong in operational memory. The current spreadsheet row may show the latest relevant values while memory preserves prior values, provenance, and process history.

The spreadsheet may retain the latest fit assessment for audit and export, but the dashboard should not expose a standalone **Fit** column. It should present the recommendation, concise rationale, verified matches, genuine gaps, and exact missing information in the opportunity details instead.

## Permissions

The tool may read records, add records, update agent-maintained fields, check duplicates, and verify updates. It must not overwrite explicit student-owned application status, notes, overrides, or corrections without a clear rule or student approval.

## Failure behavior

If the file is missing, locked, corrupted, has an incompatible schema, conflicts with a newer version, or fails read-back verification, return `FAILURE` or `PARTIAL SUCCESS` with the affected fields. Do not send a related update email. Ambiguous duplicates must be flagged rather than merged automatically.

## Security considerations

Store the workbook in a local runtime data location excluded from Git. Use least-privilege file access, safe writes and recoverable backups, spreadsheet-safe text handling, and no embedded credentials. Avoid storing unnecessary personal data or full copies of web pages when structured current fields and source references are sufficient.
