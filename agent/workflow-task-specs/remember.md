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
- Current schedule state reported by Codex and the next-review state.

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
- schedule state reported by Codex;
- student approval or rejection;
- explicit student preferences learned from user choices;
- student confirmations, clarifications, not-interested choices, and preparation requests;
- whether each student input is awaiting review, resolved, or needs more information; and
- whether the targeted update started, completed, failed, or remains ready for an explicit retry;
- locally prepared application-template identifiers and verification outcomes.

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

Pass a concise cycle summary and one control outcome: finish, request a specific student update, wait for approval, retry a failed targeted update, or await the next enabled Codex daily collection automation.

## What should be remembered

Remember only information relevant to future action, verification, policy, or continuity. Apply privacy and retention rules; do not store secrets or unnecessary personal data.
