# Email Notification — Tool Contract

## Status

Specification only; no email provider or credentials are configured.

## Responsibility

Send concise operational notifications only to an address controlled and verified by the student after a material opportunity update is successfully recorded.

## Inputs

- Verified student recipient.
- Recorded material change ID and opportunity ID.
- Subject and minimal notification body.
- Idempotency key, run ID, and tracker verification reference.

## Preconditions

- The related tracker update is durably recorded and verified.
- The change meets the material-update rule.
- No successful or still-pending notification exists for the same idempotency key.
- The recipient is the configured student address, not an employer or other third party.

## Outputs

Message attempt ID, provider receipt when available, timestamps, and status: `queued`, `accepted`, `delivered` when observable, `failed`, or `unknown`.

## Constraints

- Include only the information needed for the student to understand the update and next action.
- Never include credentials or unnecessary resume/profile data.
- Do not use this tool for recruiter communication.
- Retry only idempotently and within configured limits.

Provider acceptance is not proof of delivery. Failed notification creates an unresolved task but does not undo the recorded opportunity update.

