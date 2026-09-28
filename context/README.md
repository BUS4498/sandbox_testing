# Student Context

## Purpose

The `context/` folder contains relatively stable background information supplied to the production agent about the student and the student's internship preferences and constraints. The agent should retrieve only the context relevant to the current opportunity or run.

## Authoritative sources

- [`is-junior-resume.md`](is-junior-resume.md) is the synthetic demonstration source for claims about education, coursework, skills, projects, and experience when no student-confirmed private runtime profile is active.
- [`career-preferences.md`](career-preferences.md) is the authoritative demonstration source for preferred roles, industries, locations, work arrangements, professional interests, and role characteristics.
- [`availability-and-constraints.md`](availability-and-constraints.md) is the authoritative demonstration source for timing, geographic flexibility, scheduling constraints, and non-negotiable operating boundaries.

If these files conflict, the agent must surface the conflict rather than select the more favorable claim.

## Private runtime profile precedence

For real local use, the student uploads and confirms a resume and separately confirms preferred roles, availability, geographic and work-arrangement boundaries, and relevant constraints through the dashboard. These records remain under Git-ignored `data/local/student-profile/`. The confirmed private resume profile becomes authoritative for resume-based education, coursework, skills, projects, and experience claims. The confirmed local preference-and-constraint record becomes authoritative for those corresponding fields. An uploaded resume, partially completed form, or unsaved change is never authoritative.

The tracked synthetic files are used only when the student explicitly selects demonstration mode. The application must never silently fill gaps in an incomplete real-student setup with synthetic defaults. Source labels remain visible so the student can distinguish resume facts from separately supplied preferences and constraints. Private student context must never be copied into this tracked folder.

## Synthetic sandbox information

All student, institution, employer, project, preference, and availability information in this sandbox is completely synthetic and provided only for course development and testing. It must not be represented as information about a real student.

The agent must not infer, fabricate, or embellish qualifications unsupported by these files. Information that is not supplied remains unknown until the student provides it.

## Context is not memory

Context contains relatively stable information provided about the student or environment. Operational history generated or accumulated through agent activity—observations, decisions, actions, evaluations, unresolved tasks, notifications, and changing opportunity state—belongs in `agent/memory/`, not in `context/`.

Raw conversation history is not a substitute for either authoritative context or operational memory.
