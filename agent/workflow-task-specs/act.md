# Act Task Specification

## Purpose

Execute approved or pre-authorized operations with idempotency, minimal side effects, and an audit trail.

## Allowed design-time action categories

- Synchronize an opportunity or task to the local spreadsheet.
- Save analysis and memory locally.
- Create a draft for student review without sending it.
- Send an operational notification to the student's verified address after a material update is durably recorded.
- Invoke a student-approved retrieval or local scheduling configuration in a future implementation.

## Required checks

Before acting, confirm the decision ID, policy permission, target, exact content or field changes, approval state, idempotency key, and rollback or recovery approach.

## Output contract

Record an action ID, decision ID, target, planned effect, start/end times, idempotency key, attempt number, returned receipt or error, and provisional status: `attempted`, `accepted`, `failed`, or `unknown`.

## Guardrails

Do not send a student notification until the corresponding material tracker update is recorded. Do not send any third-party message without approval of the exact recipient and content. Do not interpret an attempted action as success; verification is a separate stage.

