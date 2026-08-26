# REASON Task Specification

## Purpose

Interpret the available evidence and produce an explainable assessment for later decision-making.

## When this task runs

Run after **SENSE** when a valid new or tracked opportunity requires assessment, reassessment, or resolution of an identified issue.

## Inputs

- Structured opportunity observation and material changes.
- Relevant verified student context.
- Current tracked status and deadline.
- Relevant prior student decisions, agent evaluations, and unresolved issues.
- The job-fit-assessment production Skill when fit assessment is needed.

## Instructions

1. Separate required qualifications, preferred qualifications, and unclear posting language.
2. Compare each relevant requirement with verified student evidence.
3. Identify strong matches, partial matches, genuine gaps, and unknowns.
4. Consider career preferences, location, availability, constraints, deadline, and urgency.
5. Incorporate relevant prior student decisions and evaluations without treating them as permanent authority.
6. Explain conflicts and uncertainty.
7. Never fabricate qualifications, experience, coursework, projects, or preferences.
8. If a pending student response addresses a prior unknown or unresolved issue, evaluate that response as student-supplied evidence, identify what it resolves, and state whether more information is still required.
9. When application-template preparation was requested, identify the verified facts, posting requirements, gaps, and placeholders that the `application-material-prep` Skill may use. Do not prepare or finalize the material inside the fit assessment itself.
10. During a targeted **Update Opportunity** workflow, reason only about the selected opportunity and the new response. Do not search for or rank other internships.

## Expected output

Structured supporting evidence that includes requirement-to-student comparisons, constraints, deadline and urgency, strengths, gaps, unresolved questions, confidence, and an explainable assessment. When evidence is insufficient, identify the exact clarification needed rather than exposing only the label `INSUFFICIENT INFORMATION`. A numerical fit score, if used, must not stand alone or replace the evidence.

## Failure and exception handling

When decisive evidence is missing, stale, or conflicting, narrow the conclusion and identify the exact information needed. Recommend escalation when a safe assessment cannot be made.

## What is passed to the next stage

Pass the evidence-backed assessment, urgency, constraints, uncertainties, and candidate next actions to **DECIDE**.

## What should be remembered

Remember materially new interpretations, identified gaps, and evidence that may change a future assessment. Do not preserve unsupported speculation as fact.
