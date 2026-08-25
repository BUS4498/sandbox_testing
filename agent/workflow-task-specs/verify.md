# VERIFY Task Specification

## Purpose

Determine whether each intended action produced its expected outcome.

## When this task runs

Run after **ACT** for every attempted local update, notification, schedule change, saved draft, or other observable action.

## Inputs

- Intended outcome from the decision.
- Action record, receipts, and reported errors.
- Current spreadsheet, notification, and scheduler state as relevant.

## Instructions

For each action, compare:

`Expected Outcome → Observed Outcome → Evaluation`

Assign `SUCCESS`, `PARTIAL SUCCESS`, or `FAILURE`.

For spreadsheet updates, verify that:

- the local spreadsheet is accessible;
- the intended row exists;
- the correct opportunity was updated;
- expected fields were written correctly; and
- no unintended duplicate was created.

For informational email, verify that:

- the attempt occurred only after the related spreadsheet update succeeded;
- the intended student recipient was used;
- the intended update was summarized; and
- the email service reported successful submission or delivery status when available.

For scheduled execution, verify that:

- the daily schedule configuration was saved;
- last-run and next-run information are available; and
- failure or missed-run state is visible.

Never claim success merely because an action was requested or attempted.

## Expected output

A verification record for each action containing expected outcome, observed outcome, evidence, evaluation, failure classification when available, and recommended next step.

## Failure and exception handling

For an incomplete outcome, identify the unresolved issue, classify the failure when possible, recommend an appropriate next step, and ensure the issue can be retrieved in the next cycle. Distinguish email submission from confirmed delivery when delivery evidence is unavailable.

## What is passed to the next stage

Pass verification records, confirmed current state, failures, unresolved issues, and recommended follow-up to **REMEMBER**.

## What should be remembered

Remember observed outcomes and evaluations, including partial and failed results. Preserve uncertainty when an outcome cannot be verified.
