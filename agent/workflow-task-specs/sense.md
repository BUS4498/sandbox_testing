# Sense Task Specification

## Purpose

Transform retrieved inputs into structured observations and identify meaningful changes without yet recommending or acting.

## Inputs

- Retrieval records.
- Prior normalized opportunity state.
- Field definitions and duplicate-prevention rules.

## Procedure

1. Extract organization, role, source, location, work mode, dates, deadline, compensation, eligibility, authorization language, requirements, responsibilities, and application status when stated.
2. Label each value as stated, derived, unknown, conflicting, or not applicable.
3. Normalize formats while retaining original evidence.
4. compare the observation with prior state and classify fields as new, changed, unchanged, removed, or uncertain.
5. Detect duplicate candidates before creating a new opportunity identity.
6. Determine whether verified changes meet the material-update definition.

## Output contract

Return an observation ID, opportunity or duplicate-candidate ID, field-level evidence and provenance, freshness, change set, materiality result with rationale, and unresolved extraction questions.

## Guardrails

Silence is not evidence that a prior requirement disappeared. A missing field in a later retrieval must be labeled uncertain unless the source explicitly removes or contradicts it.

