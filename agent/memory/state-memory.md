# State Memory Specification

## Purpose

Store the latest known operational state needed to resume work across runs while retaining links to historical observations and changes.

## Record fields

- State record ID and version.
- Entity type and stable entity ID.
- Current field values with `verified`, `stated`, `derived`, `unknown`, or `conflicting` status.
- Source observation IDs and effective/observed times.
- First seen, last changed, and last verified times.
- Profile, preference, and constraint snapshot IDs used.
- Pending task IDs and current application status.
- Superseded state version.

## Rules

Use state memory for current facts, not reasoning history. Updates require an expected prior version, preserve provenance, and never silently replace student-entered application status. Unknown and not applicable remain distinct.

## Verification and retention

Verify each write by reading the resulting version. Archive superseded state according to retention policy; do not store secrets or unnecessary personal data.

