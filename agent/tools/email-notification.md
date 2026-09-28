# Email Notification Tool Specification

## Tool name

**Student Email Notification**

## Purpose

Create an informational notification for the student after a successful material update to the tracked opportunity collection. The local implementation saves a verified preview. The approved owner-only Sites pilot adds Microsoft Graph Outlook transport only after its own authorization and verification. This tool is not for autonomous recruiter or employer contact.

## Runtime transport

The existing local implementation should:

1. keep the recipient address in private local settings;
2. generate the subject and plain-text body deterministically from verified structured workflow data;
3. save one local preview for each warranted material update;
4. verify the preview and record its idempotency key; and
5. label the result `PREVIEWED`, never `SENT` or `DELIVERED`.

The hosted pilot transport should:

1. use the owner's separate interactive Microsoft authorization with delegated `Mail.Send` and `POST /me/sendMail`;
2. confirm the connected sender address and restrict pilot delivery to that same configured address;
3. keep OAuth secrets and tokens in approved protected server-side storage, never in browser storage or operational memory;
4. persist the material-update idempotency key and an `ATTEMPTING` record before any send request;
5. report Graph `202 Accepted` as `SUBMITTED`, not `DELIVERED`;
6. preserve `UNKNOWN` when a timeout or interruption leaves submission uncertain, without automatic retry; and
7. offer an explicit disconnect/disable control.

The OpenAI API is not an email provider, and a Codex-installed Outlook plugin is not a reusable credential for either the local controller or the hosted Site. The local implementation remains preview-only unless separately revised.

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
- Notification mode and local preview destination, or the hosted Graph authorization reference and connected-account verification state.

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

The tool returns a message-attempt ID, masked intended recipient, creation time, local preview reference or non-secret Graph response metadata, and status such as `PREVIEWED`, `SUBMITTED`, `DELIVERED`, `FAILED`, or `UNKNOWN`. A Graph `202 Accepted` establishes submission to the provider only; delivery requires independent evidence, such as confirmation in the owner's inbox. Never label a send attempt delivered merely because the API returned success.

## Message generation

Generate routine opportunity-update emails deterministically from already-structured workflow information whenever it is sufficient, including:

- company;
- role;
- update type;
- deadline;
- decision;
- concise rationale; and
- next action.

Use a stable, readable notification template and preserve unknown values as unknown. Do not make an additional model call to compose or rewrite a routine notification that can be generated reliably from these fields.

## Permissions

The local tool may create informational previews only for the student's configured address, subject to the five-notification maximum for one discovery run. The hosted pilot may send informational messages only after owner authorization, a verified material collection write, and confirmation that the recipient is the same connected owner address. The tool may not autonomously contact recruiters, employers, references, or other third parties. A configured address alone does not enable live sending.

## Failure behavior

A preview-storage failure produces `FAILURE` and does not roll back the spreadsheet update. A Graph failure must not silently fall back to another external provider. Record the failed or unknown attempt separately from the successful collection write. Retry only after reconciling the prior outcome; never automatically retry `UNKNOWN`, because that could duplicate a real email. Never report submission or delivery without the required evidence.

If an attempted discovery run would exceed the five-email maximum, do not send the excess message. Record the limit violation as an unresolved workflow issue rather than silently exceeding the approved budget.

## Security considerations

Store local recipient settings and previews privately, never in GitHub. For the hosted pilot, keep the connected-account recipient and non-secret attempt ledger in private durable storage, and OAuth material only in approved protected server-side storage. Validate the recipient, redact secrets and account identity from errors, prevent header or content injection, and do not include resume details, student responses, work-authorization facts, or unrelated context in routine notifications. Test one self-addressed live message only after the owner authorizes that exact test.
