# Decide Task Specification

## Purpose

Choose the next safe operation for each opportunity and the run as a whole.

## Decision options

- Record or update local opportunity state.
- Prioritize, defer, archive, or flag for student review.
- Create or update an unresolved task.
- Draft a student-facing recommendation or third-party communication.
- Request explicit approval for a consequential action.
- Take no action because the state is unchanged.
- Escalate because evidence, authority, or safety is insufficient.

## Decision criteria

Evaluate policy permission, student constraints, deadline urgency, fit evidence, confidence, materiality, duplicate risk, action reversibility, pending approvals, and prior action outcomes.

## Output contract

Each decision records a decision ID, alternatives considered, selected option, evidence, governing policy, confidence, required approval, expiration when applicable, and intended observable result.

## Guardrails

The daily schedule never expands authority. Missing approval produces `waiting_for_student`, not implied consent. Application submission, third-party communication, and final-material changes cannot be selected as autonomous actions.

