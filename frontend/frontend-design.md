# Internship Collection Dashboard — Frontend Design

> **Design specification only.** Do not build the frontend in this phase or select a programming framework.

## Purpose and local-first model

The eventual application should run locally on the student's computer and open in the student's browser. Its primary experience is an **Internship Collection Dashboard** that makes opportunities, next actions, agent status, failures, and human-control points easy to understand.

The interface should be deliberately simple, friendly, and visually distinctive. A clean workspace or filing-desk visual language, supported by a small pixel-style agent character, can make the system approachable without competing with the internship information.

A persistent local-status label should make clear that the application and operational data are running locally.

## Runtime connection

The dashboard is the business-facing interface; it is not the agent harness. Runtime requests should follow this path:

```text
Collect Opportunities or Update Opportunity
   ↓
Frontend
   ↓
Thin Local Controller
   ↓
Codex App Server
   ↓
Existing or approved Codex thread
   ↓
Internship Application Prep Agent
```

The controller should start or resume the approved thread, submit the concise workflow instruction, surface approval requests, and translate Codex runtime events into dashboard status. It must not implement a second model-reasoning or tool-selection loop. Detailed runtime behavior belongs in `runtime/codex-runtime.md`.

**Reset Collection** is a separate local-controller operation. It must not start or reuse an agent thread because no model reasoning is required to archive and reinitialize local data.

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
- agent recommendation;
- concise evidence-based rationale;
- application status;
- next action;
- urgency; and
- unresolved issue when applicable;
- a clearly labeled **Apply** link; and
- a clearly labeled **Source** link.

Use the visible link text **Source** regardless of the provider's or career site's name. Preserve the descriptive source name in the accessible label, tooltip, opportunity details, and spreadsheet rather than stretching the card action.

Do not expose a standalone **Fit** column. Fit assessment remains structured agent evidence, but the dashboard should present what a student can act on: the recommendation, why the role aligns, verified matches, genuine gaps, and exact clarification needed. Translate internal `INSUFFICIENT INFORMATION` into **Needs clarification** and show the missing facts.

The student should be able to search, filter, sort, and open an opportunity without losing the current dashboard context.

Do not show a separate dashboard-wide **Information needed to continue** box that repeats the selected-opportunity or opportunity-card content. Put each exact question, missing fact, response status, and **Update Opportunity** control directly on the affected opportunity. The selected-opportunities area may summarize the same opportunity immediately after a run, but it should link the student to that single actionable record rather than create a second response surface.

## Reset Collection experience

Provide a secondary **Reset Collection** control near the current collection. It should be visually distinct from **Collect Opportunities** and unavailable while a workflow is active.

Selecting it must open a confirmation dialog that explains exactly what will happen:

- the active opportunity spreadsheet will be reinitialized with zero opportunity rows;
- opportunity-related operational memory, run history, application-material drafts, and notification previews will leave the active collection;
- the prior private runtime data will be copied to a dated local reset archive for recovery;
- saved student context, the notification recipient, Codex and Outlook authentication, and the Codex-managed daily schedule will remain; and
- email already submitted cannot be recalled.

Require the student to enter `RESET` before enabling the final **Archive and Reset** action. After success, refresh all collection, run-summary, material, and activity views; show the archive location; and make the next **Collect Opportunities** action start a new Codex thread with an empty current collection.

## Collect Opportunities experience

Provide a prominent **Collect Opportunities** button.

Place the **Student notification email** control immediately above the **Collect Opportunities** button. It should show whether Outlook is connected and callable, explain that the address remains local, and make clear that notifications will be sent from the connected Outlook account only after verified material updates. Do not request an Outlook password, token, or provider credential.

The button's meaning should be explicit:

> Collect relevant internship opportunities now and process the strongest new or materially changed results.

Supporting text or an accessible description should make clear that **Collect Opportunities** starts the approved general-public-web-search and opportunity-processing workflow. It does not process pending student responses, submit applications, or contact employers.

When selected:

1. ask the thin local controller to start or resume the approved Codex thread through Codex App Server and begin the production-agent workflow;
2. retrieve the relevant current student search preferences;
3. perform bounded public-web discovery and collect a limited candidate pool;
4. validate, deduplicate, and cheaply filter candidates before detailed reasoning;
5. rank the remaining candidates and select the top three to five relevant new or materially changed opportunities when at least three qualify;
6. complete the detailed workflow only for the selected opportunities;
7. visibly indicate that a run is active;
8. prevent an accidental simultaneous duplicate run;
9. show high-level progress;
10. refresh the dashboard when the run finishes; and
11. show whether spreadsheet and email actions succeeded.

Disable or replace the button with a clear active state while the run lock is held. If cancellation is eventually supported, explain which completed side effects cannot be undone.

## Update Opportunity experience

Every opportunity requiring student information should display a prominent **Update Opportunity** button near the exact question or missing information. Selecting it should open a scoped form and explain what the agent will do with the response.

The final form action should be **Save and Update**, which must:

1. save the response in student-owned notes and operational memory;
2. immediately start a targeted agent workflow for that opportunity;
3. perform no internship-market web search;
4. reassess the existing opportunity using the new response and verified evidence;
5. update permitted spreadsheet fields, prepare requested review-only materials, or request narrower clarification as applicable;
6. verify the outcome and update memory; and
7. refresh the opportunity card with the resolved issue, new recommendation, new next action, or explicit remaining question.

If the runtime is unavailable or another workflow holds the run lock, retain the saved response, mark it **Update ready to retry**, and display an **Update Opportunity** retry button. Do not require the student to use **Collect Opportunities** or wait for a daily collection run.

### Visible progress labels

The interface may display concise stage labels, but the primary status should be a larger plain-English sentence describing the observable business activity, such as:

- **Retrieving Preferences**
- **Searching the Web**
- **Reviewing Candidates**
- **Ranking Opportunities**
- **Assessing Fit**
- **Updating Collection**
- **Sending Notifications**
- **Verifying**
- **Remembering**
- **Finished**

Examples include “Reading your verified role, location, timing, and work-authorization preferences,” “Searching employer career pages for Summer 2027 analyst internships in California,” “Comparing eight validated candidates against your required qualifications,” “Adding Northstar Foods — Business Systems Intern to the local spreadsheet,” “Creating a Word cover-letter outline for Northstar Foods,” and “Submitting three verified opportunity-update emails to your saved address.” Use a company, role, candidate count, file type, or action count only when it is present in observable runtime data. Do not imply access to hidden reasoning.

Avoid vague descriptions such as “Carrying out a permitted local action.” When low-level activity cannot be classified more precisely, say what approved resource is being read or what output is being prepared, and explicitly avoid claiming that a write or external action succeeded before verification.

Display an accessible progress bar and percentage derived from completed or reached workflow stages. Treat the percentage as an approximate stage-based indicator, not a prediction of remaining time. It must move forward monotonically during a workflow, reach 100% only after verification and memory completion, and never be fabricated from chain-of-thought or token activity.

Do not display raw chain-of-thought, hidden reasoning, internal prompt text, or private scratch work. Show concise evidence, rationale, status, and observable outcomes instead.

### Runtime event mapping

Dashboard progress and pixel-character behavior must be grounded in observable Codex runtime events or verified business-tool outcomes. The controller may map event classes approximately as follows:

| Observable Codex runtime event or outcome | Dashboard state |
|---|---|
| Reading approved context or specifications | **Retrieving** |
| Web-search or browser activity | **Searching** |
| Structured candidate review, ranking, or fit-assessment activity | **Assessing** |
| Reading verified context, source rules, or prior state | **Retrieving**, naming the approved resource category being read |
| Spreadsheet add or update requested by the controller | **Updating Collection**, naming the affected opportunity when available |
| Word application-template generation | **Preparing Word Draft**, naming the opportunity and requested draft type when available |
| Informational email submission | **Sending Notifications**, showing the number of messages and saved-recipient wording when available |
| Verification activity or an observable outcome check | **Verifying** |
| Successful turn completion after required run-finalization work | **Finished** |
| Approval request or runtime failure | **Action required**, with the exact requested approval or recoverable action |
| Missing student information for a tracked opportunity | **Update [company and role]**, with the exact question and an **Update Opportunity** button |

A low-level event should be combined with the agent's explicit business-stage status when necessary; for example, generic tool activity alone does not prove that a spreadsheet update succeeded. The interface must not infer or expose hidden reasoning to create a more detailed animation.

### Run result summary

After each run, show a concise discovery summary derived from verified workflow results. For example:

```text
Today's Run

Searches performed:        3
Candidates discovered:    14
Duplicates/invalid:        6
Candidates ranked:         8
Updates selected:          5
```

These numbers are illustrative, not required values. Show the actual counts when a run stops earlier, finds fewer relevant opportunities, or encounters a failure. If fewer than three are selected, show the required selection shortfall reason. Five remains a hard maximum; do not pad the result with weak opportunities.

Also include counts or clearly labeled statuses for downstream outcomes such as:

- new opportunities added;
- existing opportunities updated;
- postings closed;
- items requiring attention;
- notifications sent; and
- unresolved issues.

Do not count an unchanged rediscovery as a new opportunity. Keep partial successes, failures, and unknown notification outcomes visible rather than incorporating them into successful totals.

### Selected opportunities

Show the selected opportunities prominently next to or immediately below the run summary. A normal successful run should show three to five when at least three qualify. Each selected opportunity should identify at least the company, role title, location or work arrangement, deadline when known, whether it is new or materially changed, concise selection evidence, current processing outcome, application link, and source link.

Do not show filtered or duplicate candidates as though they were selected. The student may inspect aggregate exclusion counts and unresolved candidates without allowing them to compete visually with the selected opportunities.

## Daily automation

The dashboard should report the optional once-per-day Codex thread automation but must not implement or manage the schedule itself in this prototype. Present a compact read-only area such as:

```text
Daily Automation
Status:    Configured in Codex
Schedule:  9:00 AM daily
Timezone:  America/Los_Angeles
Last Run:  ...
Next Run:  ...

[Open Codex to Manage Schedule]
```

Show only values confirmed by Codex or verified run state. If a value is unavailable, display **Unknown** rather than infer it. The management action should open or direct the student to Codex; do not provide duplicate On/Off or time-editing controls in the dashboard.

The dashboard should continue to provide **Collect Opportunities** independently of the automation. Both triggers use the same search-and-processing workflow, student context, duplicate-prevention rules, permissions, verification requirements, memory, and approval rules. Targeted **Update Opportunity** actions are separate, immediate, single-opportunity workflows and are not delayed until automation runs.

Clearly explain that this is a local-first workflow. If the computer, Codex application, required local runtime, or repository workspace was unavailable at the scheduled time, display **Missed Run** when the application next starts; never imply that the run occurred. Detailed schedule behavior belongs in `runtime/codex-schedule.md`.

## Pixel-style agent character

Include a small animated pixel-style character as a supplemental representation of the agent. It should be charming, easy to distinguish, and subordinate to text status and controls.

| State | Visual behavior |
|---|---|
| Waiting | Waits calmly without implying work is occurring |
| Retrieving Preferences | Opens or inspects a small folder, notebook, or filing cabinet |
| Searching the Web | Searches with a magnifying glass or scans public posting items |
| Reviewing Candidates | Sorts or validates a small group of internship cards |
| Ranking Opportunities | Arranges the remaining opportunity cards in an ordered group |
| Assessing Fit | Pauses with a small non-text assessment indicator |
| Updating Collection | Places an internship card into a small spreadsheet or table icon |
| Sending Notifications | Briefly carries or releases a small envelope icon |
| Verifying | Checks the work or displays a checkmark |
| Remembering | Files a small verified record or note |
| Finished | Shows a brief, subtle celebration |
| Student update required | Shows a clear question or form indicator and remains beside the explicit **Update Opportunity** instruction |
| Runtime or approval action required | Shows a clear warning indicator without implying success |

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

The primary recipient control belongs above **Collect Opportunities**, not in a secondary settings panel. Saving the address should update private local settings and immediately refresh a masked recipient hint.

Before a run, show Outlook connector state as **Connected**, **Needs connection**, **Disabled**, or **Unknown** based on Codex App Server evidence. A configured address does not imply that Outlook is callable.

Show:

- latest informational email status;
- the opportunity that triggered it;
- the material update summarized;
- submission or delivery time when known; and
- whether the notification succeeded, failed, or remains unknown.

Distinguish Outlook submission from confirmed delivery. Do not display sender identity, email credentials, tokens, or secret configuration.

## Actionable next steps and student responses

Every opportunity with a human-dependent next action should provide a visible **Update Opportunity** control. Opening it should show:

- the current recommendation and concise rationale;
- the exact question, confirmation, or missing information;
- accepted response type and due date when available;
- controls for **Confirm completed**, **Provide information**, **Not interested**, and **Request application materials** when applicable; and
- what the agent will do after the response is saved.

The dashboard should write the student's response to student-owned local notes and operational memory and immediately start a scoped update. During processing, show **Updating this opportunity now**. After processing, show whether the response resolved the issue, whether more information is needed, what changed, and the new recommended next action.

Student responses must not be inserted into internship-discovery web queries. The targeted update uses the existing verified posting evidence and local student context. A separate source recheck may occur only when explicitly required and must not become a general market search.

## Application-preparation workspace

Provide a **Prepare materials** action for tracked opportunities. The student may request one or more review-only templates:

- resume-tailoring checklist;
- cover-letter outline; and
- application-question worksheet.

Prepared artifacts should be saved as professionally formatted Microsoft Word `.docx` files and appear in the opportunity details with type, creation time, unresolved placeholders, and a **Download Word draft** action. Every document and dashboard record must say **Draft template — student review required**. Raw Markdown must not be the student-facing saved artifact. The dashboard must never offer **Submit application**, automatic form completion, employer upload, or a control that makes a template appear final.

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
- recommended next action;
- application and source links;
- latest student response and review status; and
- locally prepared application templates.

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
- **Update Opportunity**
- **Prepare materials**
- **Open application**
- **View source**

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
- expose failures and unresolved issues with the affected opportunity, exact requested information, and next available control;
- provide obvious human-control points;
- avoid presenting the agent as infallible;
- keep the pixel character supplemental rather than distracting;
- use short, smooth state transitions, responsive hover and pressed states, and progressive disclosure so dense evidence does not overwhelm the main collection;
- keep interactive controls close to the opportunity or status they affect and immediately confirm saved inputs;
- support keyboard use, visible focus, semantic headings, labeled controls, and screen-reader status announcements;
- avoid relying on color or motion alone;
- support zoom, reduced motion, and narrow browser windows; and
- avoid exposing credentials, technical secrets, unnecessary personal information, or raw filesystem complexity.

## Future implementation boundary

This specification does not prescribe a frontend framework. During the later build phase, Codex may choose an appropriate local implementation that satisfies these behaviors, accessibility requirements, synchronization rules, and human-authority boundaries. The implementation must connect through the thin local controller to Codex App Server and must not build a custom LLM runtime or dashboard-owned scheduler.
