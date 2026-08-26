# DECIDE Task Specification

## Purpose

Convert the evidence-backed assessment into an explicit, explainable operational decision.

## When this task runs

Run after **REASON** whenever a valid opportunity or unresolved issue requires a current decision.

## Inputs

- Evidence-backed assessment.
- Current opportunity and application status.
- Deadline and urgency.
- Relevant prior decisions and explicit student choices.
- Approval and autonomy rules.

## Instructions

1. Select one primary decision:
   - `PRIORITIZE`;
   - `MONITOR`;
   - `PREPARE`;
   - `FOLLOW UP`;
   - `ARCHIVE`; or
   - `ESCALATE TO USER`.
2. State a concise rationale grounded in the supplied evidence.
3. Identify urgency and the recommended next action.
4. State whether human input or approval is required.
5. State whether the local spreadsheet needs a new record or material update.
6. Respect explicit student decisions and approval boundaries.
7. Do not use an unexplained numerical fit score as the decision.
8. Make a human-dependent next action actionable by defining:
   - the exact question or confirmation needed;
   - the accepted response type, such as confirmation, short text, choice, or preparation request;
   - the urgency or due date;
   - what the agent will do after the student responds; and
   - whether the response will trigger reassessment or application-template preparation.
9. A recommendation to prepare materials may request the `application-material-prep` Skill, but it must not imply that an application will be completed or submitted.
10. For a targeted update, explicitly state whether the student's information resolved the prior issue, changed the recommendation or next action, triggered a review-only preparation task, or still requires a narrower clarification.

## Expected output

A decision record containing the decision, concise rationale, relevant supporting evidence, urgency, recommended next action, human-input requirement, actionable input request when needed, immediate student-response resolution when applicable, application-template recommendation when applicable, and spreadsheet-update requirement.

## Failure and exception handling

If no safe decision is supported, choose `ESCALATE TO USER` and identify the missing evidence or conflict. Do not default to a favorable decision merely to keep the workflow moving.

## What is passed to the next stage

Pass the decision record, authorized or approval-gated next action, intended spreadsheet change, and notification materiality to **ACT**.

## What should be remembered

Remember the decision, rationale, evidence references, urgency, and whether it supersedes a prior decision.
