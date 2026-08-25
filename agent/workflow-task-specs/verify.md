# Verify Task Specification

## Purpose

Determine whether each intended action produced its observable effect and accurately label what cannot be proven.

## Verification methods

- Reopen the local spreadsheet and check the intended stable ID, field values, and absence of unintended duplicates.
- Re-read saved local state and compare its checksum or version.
- Confirm scheduler configuration and next-run calculation through the local scheduler's reported state.
- For email, distinguish locally queued, provider/SMTP accepted, delivered when a delivery signal exists, bounced, failed, and unknown.
- Confirm that a draft was saved without being sent.

## Output contract

Return an evaluation ID, action ID, intended result, observed result, evidence, verification time, and outcome: `confirmed`, `partially_confirmed`, `failed`, `unknown`, or `not_verifiable`.

## Failure handling

Create an unresolved task for failed, unknown, or time-sensitive partial outcomes. Retry only when policy permits, the action is idempotent, and the retry limit is not exhausted. Never claim an email was delivered based only on provider acceptance.

