# VERIFY Task Specification

## Purpose

Determine whether each intended action produced its expected outcome.

## When this task runs

Run after **ACT** for every attempted local update, notification, saved draft, or other observable action.

## Inputs

- Intended outcome from the decision.
- Action record, receipts, and reported errors.
- Current spreadsheet and notification state, plus Codex-reported trigger or automation state when relevant.

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

For a student response, verify that the intended opportunity received the student-owned note, the targeted update workflow processed the same response identifier, the reassessed recommendation or remaining clarification is visible, and no unrelated opportunity or discovery search was processed. If immediate processing could not start or finish, preserve the response as pending and provide a clear **Update Opportunity** retry action.

For an application template, verify that the intended draft file exists in the private local material area, belongs to the correct opportunity, carries the student-review label, and does not claim submission or final approval.

For Outlook delivery, treat a completed Outlook send tool call as `SUBMITTED` unless the connector provides stronger delivery evidence. A connector failure, missing app, denied approval, or unconfirmed tool outcome must remain visible as failed or unknown.

For scheduled execution, verify that:

- the trigger source and actual run timestamp are recorded accurately;
- last-run and next-run information reported by Codex is preserved when available; and
- a failure, unavailable value, or missed-run state remains visible rather than being represented as success.

The production agent does not verify that it changed the daily automation because it has no authority to create or modify that automation.

Never claim success merely because an action was requested or attempted.

## Expected output

A verification record for each action containing expected outcome, observed outcome, evidence, evaluation, failure classification when available, and recommended next step.

## Failure and exception handling

For an incomplete outcome, identify the unresolved issue, classify the failure when possible, recommend an appropriate next step, and ensure the issue can be retrieved in the next cycle. Distinguish email submission from confirmed delivery when delivery evidence is unavailable.

## What is passed to the next stage

Pass verification records, confirmed current state, failures, unresolved issues, and recommended follow-up to **REMEMBER**.

## What should be remembered

Remember observed outcomes and evaluations, including partial and failed results. Preserve uncertainty when an outcome cannot be verified.
