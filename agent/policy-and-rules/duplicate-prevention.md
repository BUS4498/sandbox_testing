# Duplicate Prevention Policy

## Goal

Represent one internship opportunity once in current state while preserving observations from multiple URLs or runs.

## Identity signals

Prefer, in order:

1. Explicit employer or application-system posting ID plus organization.
2. Canonical application URL after removing non-identity tracking parameters.
3. Strong composite match across normalized organization, title, location, program term, and substantially similar posting content.

Weak title or organization similarity alone is not enough to merge records.

## Behavior

- Assign every opportunity a stable local ID.
- Check identity before creating a row or sending a new-opportunity notification.
- Attach alternate sources and new observations to the existing opportunity when identity is strong.
- When identity is ambiguous, create a duplicate-candidate relationship and request review rather than merging.
- Preserve field provenance when sources differ.
- Never overwrite student application status during an automatic merge.
- Support a reversible manual split or merge with an audit record.

## Notification idempotency

Derive a notification idempotency key from the stable opportunity ID, material change class, normalized changed values, and recorded-state version. A repeated run with the same verified change must not send another notification.

