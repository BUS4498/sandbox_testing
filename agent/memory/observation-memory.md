# Observation Memory Specification

## What is stored

Observation memory records relevant facts produced by approved inputs, actions, or later checks, including:

- spreadsheet update confirmed;
- email service reported submission, delivery, failure, or unknown status;
- posting expired or closed;
- deadline changed;
- scheduled run was missed;
- tool failed;
- student manually changed application status; and
- other material changes to an opportunity or operating condition.

Each record should include observation ID, opportunity or action link, source, timestamp, observed value, prior value when relevant, evidence reference, freshness, and uncertainty.

## Why it is needed

Observation memory separates what was actually observed from what the agent intended, decided, or inferred. It provides evidence for current state and later evaluation.

## When it is written

Write an observation when **SENSE** detects relevant new information, **VERIFY** reads an outcome, a tool reports a result, or the student supplies an explicit operational update. Avoid duplicating unchanged observations unless the timestamp is needed to establish freshness.

## When it is retrieved

Retrieve relevant observations during **RETRIEVE**, when comparing a posting with prior state, during **REASON**, and when verifying or explaining a material change.

## How it influences future cycles

Observation memory helps later cycles detect change, update current state, assess freshness, identify failures, and ground reasoning in evidence. A failed check is an observation about tool or source availability, not proof that an opportunity disappeared.
