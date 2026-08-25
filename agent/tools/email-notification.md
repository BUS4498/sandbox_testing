# Email Notification Tool Specification

## Tool name

**Student Email Notification**

## Purpose

Send an informational email to the student after a successful material update to the tracked opportunity collection. This tool is not for autonomous recruiter or employer contact.

## When the agent may use it

The agent may use this tool only after the related spreadsheet update has succeeded and been verified. A material update may be a new opportunity, an update to an existing opportunity, a deadline or status change, or an unresolved issue requiring attention. No notification should be sent when nothing materially changed.

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

The tool returns a message-attempt ID, intended recipient, submission time, provider receipt when available, and status such as `SUBMITTED`, `DELIVERED`, `FAILED`, or `UNKNOWN`.

## Permissions

The tool may send informational operational messages only to the student's configured and verified address. It may not autonomously contact recruiters, employers, references, or other third parties. Employer-facing communication requires a separate exact-content approval and sending capability.

## Failure behavior

A failed or unknown send does not roll back the spreadsheet update. Record an unresolved task and permit only idempotent retry under the notification policy. Distinguish service acceptance from confirmed delivery and never report delivery without evidence.

## Security considerations

Store email credentials and recipient settings locally and securely, never in GitHub. Minimize student and posting data in messages and logs, validate the recipient, redact secrets from errors, and prevent header or content injection.
