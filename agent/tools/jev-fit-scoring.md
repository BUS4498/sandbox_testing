# Jev Fit Scoring Tool Specification

## Tool name and purpose

**Jev Fit Scoring** provides an optional, preliminary 0–100 indicator for a saved opportunity. It supplements, but never replaces, the evidence-backed job-fit assessment, required/preferred qualification distinctions, student preferences, and human judgment. It is not a hiring probability, eligibility determination, or application decision.

## When the agent may use it

After **REASON** has produced a structured fit assessment for a verified, selected opportunity, the owner-only hosted pilot may request a score from TypeSafe AI System One/Jev. A targeted **Update Opportunity** may refresh a score after the relevant evidence changes. A one-time backfill may score at most five existing eligible records. Unchanged evidence must not cause another paid call.

## Required inputs and privacy boundary

Use only a compact, non-identifying projection of already-structured evidence: required and preferred matches, gaps and unknowns, role preferences, broad location/work-arrangement and timing fit, and evidence completeness. Never send an original resume, name, email address, contact details, raw student response, application materials, full posting, or free-form private constraints. Do not place student evidence in public-web search queries. If a safe projection cannot be formed, leave the score unavailable.

## Provider and scoring behavior

- Call only the approved TypeSafe AI endpoint `https://api.typesafe.ai/v1/systemone` from the server with the server-side `JEV_API_KEY`; use an approved Jev model ID such as `jev-1.13.0`. No browser or spreadsheet receives the key.
- Use explicit, ordered, descriptive fit levels. Ask narrow questions about qualification alignment, career-goal alignment, and practical constraints in one request when evidence supports them. Combine the results deterministically into a 0–100 indicator and round to five-point steps to avoid false precision. Keep the rubric and weighting version with the result.
- Do not score when posting or student evidence is insufficient, unverified, stale for the selected profile, or contradictory. `UNAVAILABLE` is not zero. A provider failure leaves the opportunity usable with its narrative assessment intact.
- Retain the model version, scoring time, rubric version, evidence fingerprint, result status, and non-secret diagnostic category. Provider confidence describes distribution across rubric levels, not correctness; do not label it a guarantee.
- At most one scoring request per eligible selected opportunity per evidence version. A discovery run processes no more than five material updates; score-only changes are not material posting updates and do not create student email notifications.

## Expected output

Return `SCORED`, `UNAVAILABLE`, `STALE`, or `FAILED` with a rounded preliminary score only for `SCORED`, an evidence-based explanation, model/rubric provenance, and the next action when unavailable or failed. Keep matches, gaps, unknowns, and the agent recommendation visible beside the indicator. A score must not automatically change `PRIORITIZE`, `MONITOR`, `PREPARE`, `FOLLOW UP`, `ARCHIVE`, or `ESCALATE TO USER`.

## Permissions, failures, and verification

Only the server may read the credential and call TypeSafe. Validate the provider response and its numeric bounds, persist the score on the same current opportunity, then read it back before reporting success. Record scoring attempts and outcomes in operational memory. Do not automatically retry an ambiguous timeout, repeat a completed backfill, or score a record assessed against a different student setup. Display a sanitized failure and retain the narrative assessment when scoring is unavailable.

