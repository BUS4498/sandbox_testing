# Decision Memory Specification

## Purpose

Preserve why the agent selected, deferred, or escalated a course of action.

## Record fields

- Decision ID, run ID, opportunity ID, and decision time.
- Decision question and alternatives considered.
- Selected option or defer/escalate outcome.
- Evidence and observation IDs.
- Policies and student preferences applied.
- Confidence, assumptions, and unresolved questions.
- Approval requirement, approval ID, scope, and expiration when applicable.
- Intended result and related action IDs.

## Rules

Decision records are append-only. A later decision may supersede an earlier one but must link to it and explain the new evidence. A remembered decision is not standing authorization unless an active approval record explicitly says so.

