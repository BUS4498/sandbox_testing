# REMEMBER Task Specification

## Purpose

Persist the operational state needed for continuity, auditability, duplicate prevention, and the next cycle.

## When this task runs

Run after **VERIFY** at the end of each cycle, including cycles that fail, stop for approval, or remain unresolved.

## Inputs

- Opportunity observation and identifier.
- Decision and rationale.
- Action attempts.
- Verification records.
- Student approvals, rejections, responses, or newly expressed preferences.
- Current schedule and next-review state.

## Instructions

Persist relevant information such as:

- opportunity identifier and current opportunity state;
- decision and rationale;
- action attempted;
- spreadsheet update outcome;
- notification outcome;
- observed result and evaluation;
- unresolved issue;
- next review date;
- schedule state;
- student approval or rejection; and
- explicit student preferences learned from user choices.

Link records so a later cycle can answer:

- What did I already do?
- What succeeded?
- What failed?
- What still needs attention?
- What should happen next?
- Has this opportunity already been processed?

Use the designated memory types and keep provenance, timestamps, and relevant record versions. Do not treat raw conversation history as the authoritative source of operational state.

## Expected output

Confirmed memory writes, updated current state, linked history, unresolved-task references, and the next review or stop state.

## Failure and exception handling

If a memory write fails, preserve the unsaved records for safe retry, surface the failure, and do not claim the cycle is fully complete. Avoid overwriting a newer state or duplicating prior records.

## What is passed to the next stage

Pass a concise cycle summary and one control outcome: finish, wait for information, wait for approval, repeat for a specific unresolved issue, or run at the next configured schedule.

## What should be remembered

Remember only information relevant to future action, verification, policy, or continuity. Apply privacy and retention rules; do not store secrets or unnecessary personal data.
