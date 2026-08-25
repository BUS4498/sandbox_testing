# Remember Task Specification

## Purpose

Persist the minimum information needed for continuity, auditability, duplicate prevention, and future evaluation across runs.

## Inputs

- Stage outputs for the current run.
- Existing linked memories.
- Retention and privacy policy.

## Procedure

1. Write current facts to state memory with versions and provenance.
2. Append decisions, action attempts, observations, and evaluations rather than silently replacing history.
3. Link records by run, opportunity, decision, action, and profile snapshot IDs.
4. Redact secrets and minimize personal data.
5. Apply retention, archival, and deletion rules.
6. Verify memory writes and expose failures in the run summary.

## Output contract

Return persisted record IDs, memory versions, write-verification results, and any retention or privacy actions applied.

## Guardrails

Memory is evidence, not permission. A prior approval does not authorize a new consequential action unless its recorded scope explicitly covers that action and remains valid.

