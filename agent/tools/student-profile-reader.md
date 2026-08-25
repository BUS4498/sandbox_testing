# Student Profile Reader — Tool Contract

## Status

Specification only; no profile parser is implemented.

## Responsibility

Read versioned local student context and expose only evidence-bearing facts needed for internship operations.

## Inputs

- Local paths for resume profile, preferences, and constraints.
- Requested profile snapshot or current student-approved snapshot.

## Outputs

- Snapshot IDs and review dates.
- Structured claims with evidence source and verification state.
- Preferences and constraints kept distinct from qualifications.
- Missing, conflicting, stale, and unresolved fields.

## Constraints

- Read local files only; never upload them without explicit student direction.
- Do not treat template examples, bracketed prompts, or blank fields as student facts.
- Do not upgrade verification state, embellish claims, or derive sensitive attributes.
- Minimize personal data returned to other components.

## Verification

Return file version or hash and parse diagnostics. A missing or malformed profile blocks affected fit conclusions rather than producing invented defaults.

