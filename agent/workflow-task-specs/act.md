# ACT Task Specification

## Purpose

Carry out the selected operational decision within the agent's authority and the student's approval boundaries.

## When this task runs

Run after **DECIDE** when an action is authorized, a local update is needed, a draft can be prepared, or human input must be requested.

## Inputs

- Decision record and intended outcome.
- Current opportunity record and material change set.
- Required approval state.
- Local spreadsheet, notification, scheduler, drafting, and memory capabilities as relevant.

## Instructions

1. Prevent duplicate opportunity records before writing.
2. Update the local spreadsheet only when:
   - a valid new opportunity is accepted into the collection; or
   - an existing opportunity has materially changed.
3. Update relevant status, recommendation, next action, deadline, or next review date.
4. After a material spreadsheet update succeeds, send one informational email to the student describing the update. Do not send a new-update notification when nothing materially changed.
5. Prepare professional communication drafts without sending them to an employer.
6. Request student approval where required, flag missing information, or record an unresolved task.
7. Schedule the next local review or configured daily run when appropriate.

The agent may autonomously read approved information, assess opportunities, update its local sandbox spreadsheet and memory, schedule local reviews, send informational update emails to the student, and prepare drafts or recommendations.

Student approval is required before changing final resume content, sending recruiter or employer communication, submitting an application, accepting or declining interviews, or making another consequential external commitment. The agent must never fabricate qualifications, impersonate the student, send unapproved employer-facing messages, or override explicit student decisions.

## Expected output

An action record listing each attempted action, target, approval basis, spreadsheet result, notification result, next review or schedule change, draft or user request created, and provisional outcome.

## Failure and exception handling

Stop any action lacking required approval. If the spreadsheet update fails, do not send the related notification. Prevent retries that could duplicate a row or email. Record partial results and unresolved tasks without claiming success.

## What is passed to the next stage

Pass intended outcomes, action attempts, receipts or errors, spreadsheet changes, notification attempts, and schedule changes to **VERIFY**.

## What should be remembered

Remember action attempts, approvals used, idempotency information, and unresolved tasks. Final success status comes from **VERIFY**, not this stage.
