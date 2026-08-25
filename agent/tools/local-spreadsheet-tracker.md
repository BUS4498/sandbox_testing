# Local Spreadsheet Tracker — Tool Contract

## Status

Specification only; no spreadsheet exists and no writer is implemented.

## Responsibility

Generate and maintain a human-readable internship collection in a local runtime data directory excluded from Git.

## Core operations

- Initialize the future workbook outside the repository.
- Upsert an opportunity by stable opportunity ID.
- Update tasks, deadlines, application status, fit summary, and verification time.
- Read back records for synchronization and verification.
- Produce a recoverable backup before risky replacement.

## Minimum opportunity fields

Stable ID, organization, role title, source URL, source posting ID, location, work mode, eligibility summary, deadline, application status, fit label, confidence, next action, first seen, last observed, last verified, and last material change.

Unknown, not applicable, and empty are distinct values. Detailed evidence and history may remain in local memory while the spreadsheet exposes the current human-readable view.

## Write contract

Every write includes run ID, action ID, idempotency key, expected prior version, and intended field changes. The tool returns the resulting version, affected stable IDs, backup reference, and provisional outcome.

## Constraints and verification

- Never write the workbook inside the Git repository.
- Prevent duplicate stable IDs and preserve student-entered fields.
- Use atomic replacement where practical and retain a recoverable prior version.
- Reopen the saved workbook and verify intended values before reporting the write as confirmed.
- A failed or locked-file write remains unresolved and must not trigger a material-update email.

