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

## Expected output

A decision record containing the decision, concise rationale, relevant supporting evidence, urgency, recommended next action, human-input requirement, and spreadsheet-update requirement.

## Failure and exception handling

If no safe decision is supported, choose `ESCALATE TO USER` and identify the missing evidence or conflict. Do not default to a favorable decision merely to keep the workflow moving.

## What is passed to the next stage

Pass the decision record, authorized or approval-gated next action, intended spreadsheet change, and notification materiality to **ACT**.

## What should be remembered

Remember the decision, rationale, evidence references, urgency, and whether it supersedes a prior decision.
