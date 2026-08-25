# Decision Memory Specification

## What is stored

Decision memory records significant decisions, including:

- `PRIORITIZE`;
- `MONITOR`;
- `PREPARE`;
- `FOLLOW UP`;
- `ARCHIVE`; and
- `ESCALATE TO USER`.

Each record should include a decision ID, opportunity ID, timestamp, selected decision, supporting rationale, relevant evidence references, urgency, recommended next action, human-input requirement, and any prior decision it supersedes.

## Why it is needed

Decision memory preserves why the agent made a recommendation, supports consistent reassessment, and lets the student inspect changes over time.

## When it is written

Write an append-only record whenever a significant decision is made, reaffirmed because of material new evidence, changed, overridden, or rejected by the student. Do not overwrite the prior rationale.

## When it is retrieved

Retrieve the latest relevant decision and any materially related prior decision during **RETRIEVE**, before reassessment in **REASON**, when avoiding repeated recommendations, and when explaining a changed recommendation.

## How it influences future cycles

Decision memory helps later cycles recognize what was already recommended, which evidence supported it, whether new evidence justifies a different decision, and whether the student previously overrode it. A prior decision is context, not standing authority or approval.
