# Internship Collection Dashboard — Frontend Design

> **Design specification only.** Do not build the frontend in this phase or select a programming framework.

## Purpose and local-first model

The eventual application should run locally on the student's computer and open in the student's browser. Its primary experience is an **Internship Collection Dashboard** that makes opportunities, next actions, agent status, failures, and human-control points easy to understand.

The interface should be deliberately simple, friendly, and visually distinctive. A clean workspace or filing-desk visual language, supported by a small pixel-style agent character, can make the system approachable without competing with the internship information.

A persistent local-status label should make clear that the application and operational data are running locally.

## Dashboard summary

Show a concise summary with indicators for:

- total tracked opportunities;
- newly added opportunities;
- `PRIORITIZE` opportunities;
- approaching deadlines;
- items needing attention;
- unresolved issues;
- last successful agent run; and
- next scheduled run.

Indicators should link or filter to the relevant records. Urgency and failure must not rely on color alone.

## Current internship collection

Display the collection in a clean table on larger screens and a readable card layout when space is limited. Keep it synchronized with the local spreadsheet.

Each opportunity should show:

- company;
- role;
- location;
- deadline;
- fit assessment;
- agent recommendation;
- application status;
- next action;
- urgency; and
- unresolved issue when applicable.

The student should be able to search, filter, sort, and open an opportunity without losing the current dashboard context.

## Run Now experience

Provide a prominent **Run Now** button.

When selected:

1. start the approved production-agent workflow;
2. visibly indicate that a run is active;
3. prevent an accidental simultaneous duplicate run;
4. show high-level progress;
5. refresh the dashboard when the run finishes; and
6. show whether spreadsheet and email actions succeeded.

Disable or replace the button with a clear active state while the run lock is held. If cancellation is eventually supported, explain which completed side effects cannot be undone.

### Visible progress labels

The interface may display concise stage or business-status labels such as:

- **Retrieving**
- **Sensing**
- **Assessing**
- **Updating Collection**
- **Sending Notification**
- **Verifying**
- **Finished**

Do not display raw chain-of-thought, hidden reasoning, internal prompt text, or private scratch work. Show concise evidence, rationale, status, and observable outcomes instead.

## Daily scheduling

Allow the student to optionally run the same approved workflow once per day. Provide:

- **Daily Run:** On / Off;
- **Run Time**;
- **Local Timezone**;
- **Last Run**; and
- **Next Run**.

The dashboard should also provide **Run Now** independently of the daily schedule.

Clearly explain that this is a local application. If the computer or required background process must be active at the scheduled time, show that limitation next to the schedule controls. If a scheduled run is missed, display **Missed Run** when the application next starts; never imply that the run occurred.

Scheduled and manual runs use the same workflow, permissions, and approval rules.

## Pixel-style agent character

Include a small animated pixel-style character as a supplemental representation of the agent. It should be charming, easy to distinguish, and subordinate to text status and controls.

| State | Visual behavior |
|---|---|
| Waiting | Waits calmly without implying work is occurring |
| Retrieving | Opens or inspects a small folder, notebook, or filing cabinet |
| Sensing | Searches with a magnifying glass or collects a posting item |
| Assessing | Pauses with a small non-text thought indicator |
| Acting | Carries or places an internship card into the collection |
| Updating spreadsheet | Places a card into a small spreadsheet or table icon |
| Sending notification | Briefly carries or releases a small envelope icon |
| Verifying | Checks the work or displays a checkmark |
| Finished | Shows a brief, subtle celebration |
| Needs attention | Shows a clear attention indicator without implying success |

The character must not reveal hidden chain-of-thought text. Its state must match the actual workflow state and must never celebrate a failed or unresolved run.

For reduced-motion users, replace animation with a static pose or icon plus the same visible text status. The character may be hidden from assistive technology when the equivalent status is already announced elsewhere.

## Recent material changes

Provide a visible recent-changes area sourced from the same updates written to the local spreadsheet and operational memory. Examples include:

- new internship added;
- deadline changed;
- recommendation changed;
- application status changed;
- follow-up due;
- opportunity archived;
- notification sent; and
- unresolved issue created.

Each entry should identify the opportunity, change type, time, resulting status, and whether attention is required. Formatting-only or unchanged observations should not appear as material changes.

## Spreadsheet synchronization

Show simple synchronization information:

- local spreadsheet available;
- last successful update;
- number of tracked opportunities; and
- latest update status.

Eventually provide an **Open Spreadsheet** action. Keep raw filesystem details hidden unless needed for troubleshooting or explicitly requested. A failed or partial write must remain visible and must not be presented as synchronized.

## Informational email status

Show:

- latest informational email status;
- the opportunity that triggered it;
- the material update summarized;
- submission or delivery time when known; and
- whether the notification succeeded, failed, or remains unknown.

Distinguish service submission from confirmed delivery. Do not display email credentials, tokens, or secret configuration.

## Opportunity detail view

Allow the student to inspect:

- posting summary and source;
- fit assessment;
- matching qualifications;
- genuine gaps and unknowns;
- current decision;
- concise rationale;
- deadline and urgency;
- spreadsheet status;
- previous agent actions;
- decision history;
- evaluation history;
- unresolved issues; and
- recommended next action.

Evidence should be understandable and traceable to posting and student context without exposing private chain-of-thought.

## Human control and action states

Clearly distinguish:

- **Recommendation:** advice the student may accept, reject, or ignore;
- **Proposed action:** an action not yet approved or completed;
- **Approved action:** the exact action the student authorized but that may not yet have run; and
- **Completed action:** an action whose expected outcome has been verified.

The interface must never make a proposed or approved action appear completed.

Possible controls include:

- **Approve**
- **Reject**
- **Prepare Draft**
- **Not Interested**
- **Reassess**
- **Archive**

An approval view should show the exact target, content or version, consequence, and opportunity before the student confirms. Application submission and employer-facing communication remain subject to the system's approval policies.

## Activity timeline

Provide a concise activity timeline showing:

- what stage ran;
- what business-level result occurred;
- what action was taken or proposed;
- whether the action succeeded; and
- what needs attention next.

Use status, evidence, and outcomes rather than private reasoning. Keep failures, partial successes, missed runs, and unresolved issues visible until resolved or dismissed by the student.

## Usability, accessibility, and trust

The interface should:

- feel approachable to undergraduate students;
- prioritize clarity over technical detail;
- emphasize opportunities and next actions;
- make agent and synchronization status visible;
- clearly distinguish recommendations from completed actions;
- expose failures and unresolved issues;
- provide obvious human-control points;
- avoid presenting the agent as infallible;
- keep the pixel character supplemental rather than distracting;
- support keyboard use, visible focus, semantic headings, labeled controls, and screen-reader status announcements;
- avoid relying on color or motion alone;
- support zoom, reduced motion, and narrow browser windows; and
- avoid exposing credentials, technical secrets, unnecessary personal information, or raw filesystem complexity.

## Future implementation boundary

This specification does not prescribe a frontend framework. During the later build phase, Codex may choose an appropriate local implementation that satisfies these behaviors, accessibility requirements, synchronization rules, and human-authority boundaries.
