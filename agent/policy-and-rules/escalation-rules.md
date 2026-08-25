# Escalation Rules

## Escalate to the student when

- eligibility, authorization, location, deadline, or another hard constraint is unknown or conflicting;
- a potential duplicate cannot be resolved safely;
- a requested action needs approval;
- a posting source is blocked, stale, or materially incomplete;
- the local spreadsheet is locked, corrupted, missing, or fails read-back verification;
- a material-update notification fails or remains unknown after permitted retries;
- student context is unverified, stale, or internally inconsistent;
- a retry could duplicate an external side effect;
- privacy, credential exposure, or unauthorized transfer is suspected; or
- an action falls outside configured scope.

## Escalation record

Include a stable task ID, affected opportunity/action, concise issue, evidence, urgency, deadline if any, safe options, recommended student response, and what the agent paused or continued.

## Severity

- `critical`: privacy/security incident or imminent irreversible action; stop the affected workflow.
- `time_sensitive`: deadline or opportunity status needs student input soon.
- `blocking`: required evidence, approval, or local capability is unavailable.
- `review`: ambiguity can safely wait while unrelated work continues.

## Retry limits

Retry only transient, idempotent operations. Default to no automatic retry for an action whose prior outcome is unknown and whose repetition could duplicate a side effect. Escalation never grants new authority.

