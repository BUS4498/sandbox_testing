# ACT Task Specification

## Purpose

Carry out the selected operational decision within the agent's authority and the student's approval boundaries.

## When this task runs

Run after **DECIDE** when an action is authorized, a local update is needed, a draft can be prepared, or human input must be requested.

## Inputs

- Decision record and intended outcome.
- Current opportunity record and material change set.
- Required approval state.
- Local spreadsheet, notification, application-template storage, drafting, and memory capabilities as relevant.

## Instructions

1. Prevent duplicate opportunity records before writing.
2. Update the local spreadsheet only when:
   - a valid new opportunity is accepted into the collection; or
   - an existing opportunity has materially changed.
3. Update relevant status, recommendation, next action, deadline, or next review date.
4. After a material spreadsheet update succeeds, submit one informational email to the student's configured address through the connected Outlook Email app. Do not send a new-update notification when nothing materially changed.
5. Accept a student confirmation, clarification, not-interested choice, or preparation request through the local dashboard; write student-owned notes without overwriting other student decisions; and immediately start the scoped **Update Opportunity** workflow. If the runtime is unavailable, preserve the response as pending and show a clear retry action.
6. When requested and supported by verified evidence, use the `application-material-prep` Skill and Local Application Materials tool to create review-only Microsoft Word `.docx` templates. Label them as drafts, keep unresolved placeholders visible, and do not change final application materials.
7. Prepare professional communication drafts without sending them to an employer.
8. Request student approval where required, flag missing information, or record an unresolved task.
9. Record the next review date or recommend a Codex automation change when appropriate. The agent must not create or modify the Codex automation.

The agent may autonomously read approved information, assess opportunities, immediately process a student-supplied update for one tracked opportunity, update its local sandbox spreadsheet and memory, record next-review dates, send informational update emails to the student's configured address through Outlook, and prepare local review-only templates, drafts, or recommendations.

Student approval is required before changing final resume content, treating an application template as final, sending recruiter or employer communication, submitting an application, accepting or declining interviews, or making another consequential external commitment. The agent must never fabricate qualifications, impersonate the student, send unapproved employer-facing messages, override explicit student decisions, or implement an application-submission capability.

## Expected output

An action record listing each attempted action, target, approval basis, spreadsheet result, notification result, next review, automation-change recommendation, draft or user request created, and provisional outcome.

## Failure and exception handling

Stop any action lacking required approval. If the spreadsheet update fails, do not send the related notification. Prevent retries that could duplicate a row or email. Record partial results and unresolved tasks without claiming success.

## What is passed to the next stage

Pass intended outcomes, action attempts, receipts or errors, spreadsheet changes, notification attempts, and next-review changes to **VERIFY**.

## What should be remembered

Remember action attempts, approvals used, idempotency information, and unresolved tasks. Final success status comes from **VERIFY**, not this stage.
