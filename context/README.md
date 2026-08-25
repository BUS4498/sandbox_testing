# Student context templates

These files are design-time templates. They contain no real student information and must not be treated as evidence of a student's qualifications.

Before a future agent uses student context, the student should complete and verify the templates. Sensitive or identifying details should be stored in a private local context location such as `context/private/`, which is excluded from Git, especially when the repository is public.

## Files

- [`is-junior-resume.md`](is-junior-resume.md): structured, evidence-bearing resume facts.
- [`career-preferences.md`](career-preferences.md): preferred roles, industries, locations, and tradeoffs.
- [`availability-and-constraints.md`](availability-and-constraints.md): dates, work authorization, schedule, and non-negotiable constraints.

## Verification rules

Each factual claim used in fit assessment must have a verification state:

- `verified`: confirmed by the student against a reliable source;
- `student-asserted`: provided by the student but not independently checked;
- `unverified`: present but not safe to use as a qualification claim; or
- `unknown`: not provided.

The future agent may ask the student to resolve missing information. It must not upgrade a claim's verification state on its own.

