# Internship Application Operations Agent

> **Project phase:** Design and specification only. This repository does not contain a working agent, dashboard, API, integration, scheduler, or internship spreadsheet.

## Project goal

This project specifies a local-first agentic system that helps an undergraduate student manage internship opportunities from discovery through application follow-up. The eventual application will run on the student's computer and keep the student in control of consequential actions.

The future system should help the student:

- collect and interpret internship postings;
- compare requirements with a verified student profile and resume;
- assess fit, prioritize opportunities, and explain the evidence used;
- track deadlines, application status, unresolved tasks, and next actions;
- maintain a synchronized local spreadsheet of the current opportunity collection;
- notify the student by email after a material opportunity update is successfully recorded;
- verify whether intended actions succeeded; and
- preserve relevant state, decisions, actions, observations, and evaluations across runs.

## Operating model

The eventual agent supports two student-controlled triggers:

1. **Run Now:** the student starts a run from the local dashboard.
2. **Optional daily run:** the student enables and configures a local schedule. The schedule is off by default and can be paused or disabled at any time.

Both triggers use the same lifecycle:

`Retrieve -> Sense -> Reason -> Decide -> Act -> Verify -> Remember`

A run may collect and analyze information without creating an external side effect. Any side effect must follow the approval rules in [`agent/policy-and-rules/autonomy-and-approval.md`](agent/policy-and-rules/autonomy-and-approval.md).

## Non-negotiable boundaries

The agent must never:

- submit an internship application autonomously;
- invent, embellish, or infer unverified student qualifications as facts;
- alter final resumes, cover letters, portfolios, or application answers without student approval;
- send recruiter, employer, alumni, or other third-party communications without student approval;
- conceal uncertainty, failed actions, or stale information;
- store the generated spreadsheet, credentials, or runtime memory in Git; or
- treat a fit assessment as a guarantee of selection.

Automatic email is limited to operational notifications sent to the student's verified address after a material update has been durably recorded. Recruiter-facing messages are always drafts until approved.

## What counts as a material opportunity update

A material update is a newly recorded opportunity or a verified change that can affect whether, when, or how the student should act. Examples include changes to eligibility, deadline, role status, location, work authorization, compensation, required qualifications, application status, or fit priority. Formatting-only changes and repeated observations of unchanged data are not material.

## Repository map

```text
agent/     Agent contract, lifecycle task specifications, tool contracts, policies, memory schemas, and fit-assessment skill
context/   Safe, student-completed context templates; no real personal data is included
frontend/  Local dashboard design specification
data/      Runtime-data location and spreadsheet design notes; no spreadsheet is committed
```

The root [`.env.example`](.env.example) documents future configuration names without providing credentials. [`.gitignore`](.gitignore) defines the minimum exclusions for secrets and local runtime data.

## Design principles

- **Local first:** personal data and operational state remain on the student's computer unless the student configures a specific external service.
- **Evidence before recommendation:** postings and student qualifications retain provenance, timestamps, and uncertainty.
- **Approval before consequence:** application submission, final-material changes, and third-party communication require explicit approval at the moment of action.
- **Idempotent operations:** repeated runs should update an existing opportunity rather than create duplicates or repeat notifications.
- **Verifiable outcomes:** attempted, accepted, confirmed, failed, and unknown are distinct states.
- **Recoverable history:** important changes are appended to an audit trail rather than silently overwritten.
- **Accessible explanations:** the dashboard shows why an opportunity was prioritized and what remains unresolved.

## Implementation gate

Implementation should begin only after these specifications are reviewed for course scope, privacy assumptions, approval boundaries, data fields, and observable success criteria. Production code and live credentials do not belong in this design phase.

