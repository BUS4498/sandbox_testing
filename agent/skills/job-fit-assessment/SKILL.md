---
name: job-fit-assessment
description: Assess whether an internship meaningfully fits a student's verified profile, preferences, location, and timing constraints. Use to produce evidence for the Reason and Decide stages, not to predict hiring, create qualifications, or submit applications.
metadata:
  short-description: Evidence-based internship fit assessment
---

# Job Fit Assessment

Assess an internship against the student's authoritative context. Return structured evidence that the production agent can use during **REASON** and **DECIDE**; do not make or execute the final operational decision.

## Required inputs

- Structured job-posting observation with source and observation time.
- Relevant verified student context from `context/`.
- Career preferences.
- Availability, location, and timing constraints.
- Current deadline and unresolved information.

If decisive posting or student information is missing, return `INSUFFICIENT INFORMATION` and identify what must be retrieved or asked.

## Assessment instructions

1. Separate posting statements into required qualifications, preferred qualifications, responsibilities, and unclear items.
2. Compare every relevant required qualification with verified student evidence.
3. Consider applicable coursework, projects, technical and business skills, and experience without assuming that a mention proves proficiency.
4. Identify strong matches, partial matches, genuine gaps, and unknowns.
5. Evaluate alignment with career preferences and desired role characteristics.
6. Check location, work arrangement, internship dates, deadline, and other stated constraints.
7. Explain uncertainty and cite the posting and context evidence supporting each conclusion.
8. Never invent, embellish, or upgrade a qualification.

## Evidence classifications

Classify each relevant posting item as:

- `STRONG MATCH`: verified context directly supports the item;
- `PARTIAL MATCH`: related verified evidence exists but does not fully support the item;
- `GAP`: verified context does not support the item;
- `UNKNOWN`: available evidence cannot resolve the item; or
- `NOT APPLICABLE`: the item does not apply to the assessment.

Keep required and preferred qualifications separate. A gap in a preferred qualification does not carry the same meaning as a gap in a stated requirement.

## Overall fit explanation

Use one of these evidence-based assessments:

- `STRONG`: required qualifications are substantially supported, no verified blocking constraint is present, and the opportunity aligns well with the student's goals.
- `MODERATE`: the opportunity has meaningful alignment but includes manageable gaps, uncertainty, or preference tradeoffs.
- `WEAK`: a verified blocking constraint, major required-qualification gaps, or substantial goal mismatch makes the opportunity a low priority.
- `INSUFFICIENT INFORMATION`: decisive evidence is missing, stale, or contradictory.

Explain why the label applies. Do not reduce fit to one unexplained numerical score. Any numerical aid must remain secondary, transparent, and traceable to the evidence matrix.

## Output contract

Return:

- opportunity and posting-observation identifiers;
- student-context snapshot references;
- required-qualification evidence matrix;
- preferred-qualification evidence matrix;
- verified strong matches;
- genuine gaps and unknowns;
- coursework, project, skill, and experience evidence used;
- career-preference alignment;
- location and timing constraint results;
- overall fit: `STRONG`, `MODERATE`, `WEAK`, or `INSUFFICIENT INFORMATION`;
- concise explanation and confidence based on evidence completeness;
- unresolved questions; and
- candidate considerations for the **DECIDE** stage.

## Boundaries

Do not predict selection, fabricate qualifications, alter student context, decide on the student's behalf, edit final application materials, contact an employer, or submit an application.


