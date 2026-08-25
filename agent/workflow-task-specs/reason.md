# Reason Task Specification

## Purpose

Develop evidence-backed interpretations, fit assessments, deadline risk, and candidate next actions from normalized observations and verified student context.

## Inputs

- Current opportunity observations and change sets.
- Versioned student profile, preferences, and constraints.
- Relevant prior decisions and evaluations.
- [`../skills/job-fit-assessment/SKILL.md`](../skills/job-fit-assessment/SKILL.md).

## Procedure

1. Separate posting requirements into required, preferred, contextual, and unclear.
2. Map each requirement to verified student evidence, partial evidence, no evidence, or unknown.
3. Apply hard student constraints before preference-based ranking.
4. Assess fit and confidence using the job-fit skill.
5. Identify deadline urgency, missing information, and reversible candidate next actions.
6. State alternative interpretations when evidence conflicts or is incomplete.

## Output contract

Return requirement mappings, fit label, confidence, rationale, constraint results, deadline assessment, gaps, questions, and candidate next actions. Each conclusion links to posting evidence and the exact profile snapshot used.

## Guardrails

Reasoning must not fabricate a qualification, treat a preference as a fact, use protected characteristics for ranking, or describe fit as a hiring prediction.

