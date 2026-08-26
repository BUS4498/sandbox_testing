# Evaluation Memory Specification

## What is stored

Evaluation memory records whether an intended outcome was achieved. Each record includes:

- evaluation ID and linked action or decision;
- expected outcome;
- observed outcome;
- evaluation: `SUCCESS`, `PARTIAL SUCCESS`, or `FAILURE`;
- verification evidence and timestamp;
- unresolved issue;
- recommended corrective action; and
- next review date or condition.

When an outcome cannot be confirmed, the observed outcome and unresolved issue must preserve that uncertainty.

For web discovery and related collection updates, evaluation memory should preserve whether:

- the opportunity was successfully validated against sufficient source evidence;
- the spreadsheet was correctly updated when an update was intended;
- the informational notification succeeded when one was warranted;
- the Outlook connector outcome supported `SUBMITTED`, `DELIVERED`, `FAILED`, or `UNKNOWN` without overstating delivery;
- a student response was recorded and queued for the promised review;
- requested application templates were saved locally, verified, and still labeled for student review; and
- an unresolved source-verification issue remains.

## Why it is needed

Evaluation memory prevents the agent from equating a request or attempt with success. It supports recovery, learning, and reliable continuation across runs.

## When it is written

Write evaluation memory after **VERIFY** compares expected and observed outcomes, including opportunity validation, source verification, spreadsheet writes, email notifications, scheduled-run triggers, saved drafts, and failed or partial actions. Write a new linked evaluation if later evidence changes the result.

## When it is retrieved

Retrieve relevant evaluations during **RETRIEVE**, before **REASON** reassesses an opportunity, before retrying a failed or unknown action, and when unresolved issues become due for review.

## How it influences future cycles

Evaluation memory informs **RETRIEVE** about failures, unresolved source-verification issues, and pending follow-up, and informs **REASON** about whether prior actions or recommendations produced the intended result. It drives corrective actions, retry safety, escalation, and the next review without erasing prior evaluations.
