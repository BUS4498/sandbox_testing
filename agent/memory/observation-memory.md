# Observation Memory Specification

## What is stored

Observation memory records relevant facts produced by approved inputs, actions, or later checks, including:

- opportunity discovered;
- posting verified against an accessible source;
- posting unavailable or inaccessible;
- posting expired or closed;
- material change detected;
- source could not be verified;
- spreadsheet update confirmed;
- email service reported submission, delivery, failure, or unknown status;
- Outlook app was callable, unavailable, denied, or required reconnection;
- student supplied a confirmation, clarification, not-interested choice, or preparation request;
- application template was saved, unavailable, or failed verification;
- deadline changed;
- scheduled run was missed;
- tool failed;
- student manually changed application status; and
- other material changes to an opportunity or operating condition.

Each record should include observation ID, opportunity or action link, source, timestamp, observed value, prior value when relevant, evidence reference, freshness, and uncertainty.

Store structured evidence and source references sufficient to support later comparison and verification. Do not store unnecessary full web pages when structured opportunity information, relevant evidence, and source URLs are sufficient.

## Why it is needed

Observation memory separates what was actually observed from what the agent intended, decided, or inferred. It provides evidence for current state and later evaluation.

## When it is written

Write an observation when **SENSE** discovers or rechecks an opportunity, detects relevant new information, or encounters a meaningful source-verification issue; when **VERIFY** reads an outcome; when a tool reports a result; or when the student supplies an explicit operational update. Avoid duplicating unchanged observations unless the timestamp is needed to establish freshness.

## When it is retrieved

Retrieve relevant observations during **RETRIEVE**, when comparing a posting with prior state, during **REASON**, and when verifying or explaining a material change.

## How it influences future cycles

Observation memory helps later cycles detect change, update current state, assess freshness, identify failures, and ground reasoning in evidence. A failed check is an observation about tool or source availability, not proof that an opportunity disappeared.
