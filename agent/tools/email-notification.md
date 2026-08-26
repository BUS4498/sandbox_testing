# Email Notification Tool Specification

## Tool name

**Student Email Notification**

## Purpose

Send an informational email to the student after a successful material update to the tracked opportunity collection through the connected Codex **Outlook Email** app. This tool is not for autonomous recruiter or employer contact.

## Runtime transport

The initial implementation should use the Outlook Email connector installed and authenticated in Codex. The local controller should:

1. confirm through Codex App Server that the Outlook app is accessible, enabled, and callable;
2. keep the recipient address in private local settings;
3. generate routine message subject and plain-text body deterministically from verified structured workflow data;
4. invoke Outlook through a Codex app mention and the approved send capability;
5. batch up to five exact routine messages in one transport turn when practical;
6. observe the completed connector tool calls; and
7. record only minimum non-identifying delivery metadata in operational memory.

Codex owns Outlook OAuth and account authentication. The repository, `.env`, spreadsheet, operational memory, and dashboard must not collect or store the Outlook password, access token, refresh token, or sender-account identifier.

## When the agent may use it

The agent may use this tool only after the related spreadsheet update has succeeded and been verified. A material update may be a new opportunity, an update to an existing opportunity, a deadline or status change, or an unresolved issue requiring attention.

A discovery run processes three to five selected opportunities when at least three qualify and may send no more than five corresponding opportunity-update emails. Send only the notifications warranted by successfully recorded material updates.

No opportunity-update email should be sent for:

- a duplicate;
- an unchanged opportunity;
- an invalid candidate; or
- a candidate filtered out before selection.

## Required inputs

- Verified student recipient address.
- Material-update ID and verified spreadsheet-update result.
- Update type.
- Company and role.
- What changed.
- Relevant deadline.
- Current agent recommendation and rationale.
- Recommended next action.
- Whether student attention is required.
- Idempotency key and run ID.
- Confirmed Outlook app ID or connector reference supplied by Codex App Server.

## Expected output

The message should clearly identify:

- whether this is a new opportunity, an existing-opportunity update, a deadline/status change, or an unresolved issue;
- what changed;
- the company and role;
- the relevant deadline;
- the current agent recommendation;
- why the update matters;
- the recommended next action; and
- whether student attention is required.

The tool returns a message-attempt ID, masked intended recipient, submission time, non-secret Outlook tool-call receipt when available, and status such as `SUBMITTED`, `DELIVERED`, `FAILED`, or `UNKNOWN`. A completed Outlook send tool call establishes submission, not delivery, unless stronger evidence is returned.

## Message generation

Generate routine opportunity-update emails deterministically from already-structured workflow information whenever it is sufficient, including:

- company;
- role;
- update type;
- deadline;
- decision;
- concise rationale; and
- next action.

Use a stable, readable notification template and preserve unknown values as unknown. Do not make an additional model call to compose or rewrite a routine notification that can be generated reliably from these fields. A bounded Codex connector turn may be used solely to invoke the installed Outlook send capability for an exact, already-composed batch; it must not re-reason about opportunities or rewrite the messages.

## Permissions

The tool may send informational operational messages only to the student's configured and verified address, subject to the five-opportunity-email maximum for one discovery run. Configuring the recipient enables this business action but does not bypass Outlook connector permissions; if Codex requests connector approval, the dashboard must surface it and wait. The tool may not autonomously contact recruiters, employers, references, or other third parties. Employer-facing communication requires a separate exact-content approval and sending capability.

## Failure behavior

A missing, disabled, inaccessible, or non-callable Outlook app produces `NOT CONFIGURED` or `FAILURE`; it must not silently fall back to another external provider. A failed or unknown send does not roll back the spreadsheet update. Record an unresolved task and permit only idempotent retry under the notification policy. Distinguish connector submission from confirmed delivery and never report delivery without evidence.

If an attempted discovery run would exceed the five-email maximum, do not send the excess message. Record the limit violation as an unresolved workflow issue rather than silently exceeding the approved budget.

## Security considerations

Store only the recipient setting locally and securely, never in GitHub. Outlook credentials remain in Codex-managed authentication. Minimize student and posting data in messages and logs, validate the recipient, redact secrets and account identity from errors, prevent header or content injection, and do not include resume details or student responses in routine notifications.
