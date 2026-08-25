# Action Memory Specification

## Purpose

Record attempted side effects and local mutations separately from decisions and verified outcomes.

## Record fields

- Action ID, decision ID, run ID, and opportunity ID.
- Action type, target, and exact planned effect.
- Approval ID when required.
- Idempotency key and attempt number.
- Start/end times and tool contract used.
- Request summary with secrets redacted.
- Receipt, returned version, or error.
- Provisional status: `attempted`, `accepted`, `failed`, or `unknown`.
- Related evaluation ID and retry relationship.

## Rules

Append every attempt, including failures. Never rewrite an unknown attempt as failed merely to permit a retry. Do not store credentials or unnecessary full message bodies when a safe content hash and draft reference suffice.

