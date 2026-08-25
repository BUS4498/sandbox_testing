---
name: job-fit-assessment
description: Assess an internship posting against a verified student profile, preferences, and constraints with evidence-linked requirements, explicit uncertainty, and a non-predictive fit recommendation. Use for opportunity triage and prioritization, not application submission or qualification creation.
---

# Job Fit Assessment

Assess whether an internship is a meaningful use of the student's limited application time. Produce an explainable recommendation without predicting hiring or changing the student's profile.

## Required inputs

- Current posting observation with source and retrieval time.
- Versioned student resume/profile snapshot.
- Versioned career preferences and availability/constraints.
- Prior assessment only when reassessing a changed posting.

If the posting, profile, or a decisive constraint is missing or too stale, return `not_enough_information` and identify the smallest student question or retrieval needed.

## Evidence rules

- Separate required, preferred, contextual, and unclear posting statements.
- Match qualifications only to verified or clearly labeled student-asserted evidence.
- Never infer proficiency from a course title, job title, tool mention, or demographic attribute alone.
- Mark each requirement `matched`, `partially_matched`, `not_matched`, `unknown`, or `not_applicable` and cite both posting and profile evidence.
- Keep career preferences distinct from qualifications.
- Treat work authorization, dates, location, enrollment, graduation timing, and other hard constraints as blocking or unresolved before general fit.
- Do not use protected characteristics in scoring or ranking.

## Assessment method

1. Identify explicit hard eligibility constraints and test them against verified student constraints.
2. Build a requirement-to-evidence matrix for required and preferred qualifications.
3. Evaluate role/learning alignment, location/work-mode alignment, timing, and student-approved preferences.
4. Note transferable evidence without claiming equivalence that the evidence cannot support.
5. Assign a fit label and confidence based on evidence coverage and uncertainty.
6. Recommend one next action that is safe and proportional to the deadline.

## Fit labels

- `strong_fit`: no known blocking constraint; most required qualifications have credible evidence; the role materially aligns with student goals.
- `reasonable_fit`: no known blocking constraint; important requirements have evidence, with manageable gaps or preferences not fully aligned.
- `stretch_fit`: potentially worthwhile for learning or interest, but one or more important non-eligibility requirements lack evidence.
- `not_a_fit`: a verified blocking constraint or substantial mismatch makes application effort difficult to justify. State the evidence without discouraging language.
- `not_enough_information`: decisive posting or student facts are unknown, stale, or conflicting.

Use labels consistently, but do not force a numeric score when the evidence does not support one. Confidence reflects evidence completeness and freshness, not hiring likelihood.

## Output contract

Return:

- assessment ID, opportunity ID, posting observation ID, and context snapshot IDs;
- fit label and `high`, `medium`, or `low` confidence;
- hard-constraint results;
- requirement-to-evidence matrix with sources;
- preference and learning alignment;
- verified strengths, evidence gaps, and unresolved questions;
- concise rationale and alternative interpretation when material;
- recommended next action and deadline urgency; and
- comparison with the prior assessment when a material change triggered reassessment.

## Boundaries

Do not fabricate qualifications, edit application materials, submit an application, or contact a third party. A fit assessment is advisory and must remain inspectable and reversible in prioritization.

