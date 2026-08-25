# Duplicate Prevention Policy

## Purpose

Prevent duplicate opportunity rows, incorrect new-opportunity classifications, and repeated notifications for the same event.

## Opportunity identity

Use the strongest available identifiers, including:

1. employer or application-system opportunity ID;
2. canonical posting URL;
3. normalized company and role title; and
4. location when relevant to distinguish separate openings.

Tracking parameters should not create a new identity. Company or role similarity alone may be insufficient when an employer has multiple openings.

## Before adding an opportunity

The agent must check the current spreadsheet and relevant memory for a matching opportunity ID, canonical posting URL, or strong composite match. It must not:

- create duplicate spreadsheet rows for the same opportunity;
- treat an unchanged opportunity as a new one; or
- send repeated "new opportunity" emails for an already-recorded opportunity.

When identity is uncertain, flag a possible duplicate and ask the student rather than merge or add automatically.

## Material changes

If an existing opportunity materially changes, the agent should:

1. update the existing record;
2. identify the fields that changed;
3. preserve the prior value in operational history;
4. verify the spreadsheet update; and
5. create one corresponding update notification to the student.

A material change may include deadline, posting status, requirements, recommendation, application status, or a due follow-up action. Formatting changes and repeated unchanged observations are not material.

## Notification idempotency

Assign each notification an idempotency key based on the stable opportunity ID, material change type, resulting record version, and normalized changed values. A successful or pending notification with the same key must not be sent again. A retry after failure must reuse the key and preserve the prior attempt history.

## Manual correction

Student-approved merges or splits must be reversible, retain provenance, and never overwrite explicit student-owned status or notes.
