# Local Dashboard Design

## Purpose

The future frontend is a local dashboard for one undergraduate student. It makes the agent's evidence, decisions, pending approvals, action results, and local data location visible. This file specifies behavior and information architecture only; it does not select or implement a frontend framework.

## Primary navigation

### Overview

- **Run Now** control with a clear confirmation, progress state, cancel option where safe, and last-run summary.
- Daily schedule status showing off, enabled, paused, next planned run, local time, and timezone.
- Counts for new material updates, approaching deadlines, unresolved tasks, pending approvals, and failed verifications.
- A recent-activity timeline that separates observations, decisions, attempted actions, and verified outcomes.

### Opportunities

- Searchable and filterable collection synchronized with the local spreadsheet.
- Columns for organization, role, deadline, application status, fit label, confidence, next action, and last verified time.
- Opportunity detail view with the original source, observed posting facts, requirement-to-profile evidence matrix, uncertainties, change history, and duplicate relationships.
- Side-by-side distinction between posting facts, student facts, agent inferences, and unresolved questions.

### Tasks and approvals

- Queue of unresolved student tasks, verification failures, and decisions needing input.
- Approval cards state the exact proposed action, target, content, affected records, reversibility, and expiration.
- Application submission is never offered as an autonomous action.
- Recruiter communications and final-material changes remain drafts until the student explicitly approves the exact version.

### Notifications

- Log of student-directed email notifications with `queued`, `accepted`, `delivered` when observable, `failed`, or `unknown` status.
- Material change that triggered each notification and its idempotency key.
- Retry control for failed student notifications that prevents duplicate sends.

### Settings and data

- Visible local runtime data path and spreadsheet path.
- Open-folder and export controls in a future implementation.
- Verified student notification address.
- Daily schedule controls, off by default.
- Data retention and deletion controls.
- Context snapshot dates and links to resolve unverified profile facts.

## Core interaction states

Every run displays one of: `not started`, `running`, `waiting for student`, `completed`, `completed with unresolved items`, `failed`, or `cancelled`. Each stage shows timestamps and counts. The interface must never replace an error with a success message merely because a later stage continued.

When a material update is recorded, the interface first confirms durable local storage, then shows notification progress. A failed notification does not roll back the opportunity update; it creates an unresolved task.

## Safety and trust

- Show approval boundaries next to consequential controls.
- Present recommendations as recommendations, not guarantees.
- Cite the posting and profile evidence behind each fit assessment.
- Label stale, missing, inferred, and conflicting information.
- Never display credentials or full secrets.
- Warn before opening an external site or transferring data outside the computer.

## Accessibility and usability

- Full keyboard operation, visible focus, semantic headings, labeled controls, and status messages exposed to assistive technology.
- Do not rely on color alone for fit, urgency, or error states.
- Support zoom and narrow screens without hiding approvals or evidence.
- Use plain language suitable for an undergraduate student and explain specialized terms in context.
- Preserve student-entered text and drafts through recoverable local saves.

## Acceptance criteria for a future implementation

The dashboard must let the student start a run, configure or disable the daily schedule, locate the spreadsheet, inspect evidence for a recommendation, resolve an unknown, review pending approvals, and distinguish recorded updates from email-notification outcomes without using a command line.

