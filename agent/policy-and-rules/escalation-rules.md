# Escalation Rules

## Purpose

Define when the agent must ask the student rather than improvise, assume authority, or hide uncertainty.

## Escalate to the student when

- posting requirements are contradictory;
- qualification information is missing, stale, or conflicting;
- an application deadline is unclear;
- duplicate status is uncertain;
- the spreadsheet cannot be read, written, or verified;
- an informational email fails or has an unknown outcome;
- scheduler configuration or a scheduled run fails;
- a consequential external action is proposed;
- required approval is missing, expired, or no longer matches the action;
- a decision falls outside the agent's defined authority;
- a student instruction conflicts with current recorded state;
- a source is inaccessible and the missing information affects the decision; or
- privacy, credential, or data-integrity risk is suspected.

## Escalation content

Each escalation should state:

- the affected opportunity, action, or run;
- what is known;
- what is uncertain or failed;
- why the issue matters;
- the safe options available;
- the recommended student response;
- urgency or deadline; and
- what the agent paused or can safely continue.

## Safe behavior while waiting

Do not fabricate a value, repeat a possibly successful external action, or continue a consequential action while waiting. The agent may continue unrelated read-only or local work when it is safe and clearly separated from the escalation.

## Failure severity

- **Critical:** suspected secret exposure, unauthorized disclosure, or imminent irreversible action; stop the affected workflow.
- **Time-sensitive:** deadline, interview, or opportunity status requires prompt student input.
- **Blocking:** essential evidence, approval, spreadsheet access, email, or scheduler capability is unavailable.
- **Review:** ambiguity can safely wait while other scoped work continues.

## Carry forward

Record the unresolved issue, evidence, severity, student question, and next review date so the next cycle can retrieve it. Escalation never grants additional authority.
