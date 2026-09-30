# Internship Collection Dashboard — Frontend Design

> **Design specification only.** Do not build the frontend in this phase or select a programming framework.

## Purpose and local-first model

The eventual application should run locally on the student's computer and open in the student's browser. Its primary experience is an **Internship Collection Dashboard** that makes opportunities, next actions, agent status, failures, and human-control points easy to understand.

The interface should be deliberately simple, friendly, and visually distinctive. A clean workspace or filing-desk visual language, supported by a small pixel-style agent character, can make the system approachable without competing with the internship information.

A persistent local-status label should make clear that the application and operational data are running locally.

The sections below describe the local dashboard unless a hosted exception is stated. The hosted student Site is a separate interface variant described under **Hosted student Site** below. It must not show a local-status label or local file path as though the Site were running on the student's computer.

## Runtime connection

The dashboard is the business-facing interface; it is not the agent harness. Runtime requests should follow this path:

```text
Collect Opportunities or Update Opportunity
   ↓
Frontend
   ↓
Thin Local Controller
   ↓
OpenAI Responses API
   ↓
Bounded model-supported discovery and assessment
```

The controller should load only the task-relevant specifications and context, submit a bounded API request, validate the structured result, perform permitted local actions, and translate controller/API/tool milestones into dashboard status. The model cannot write local data or approve consequential actions. Detailed runtime behavior belongs in `runtime/openai-api-runtime.md`.

The hosted variant uses an authenticated Sites dashboard and hosted deterministic controller with private durable persistence. Live email is disabled in the current student release; a separately approved provider connection would be required before any hosted send. It must not call the laptop's loopback controller or read its files. Current audience and safeguards belong in `runtime/codex-sites-student-release.md`; the earlier private-pilot design remains historical context.

**Reset Collection** is a separate local-controller operation. It must not invoke the API because no model reasoning is required to archive and reinitialize local data.

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

Keep the top workbench compact on desktop: show setup readiness, the verified provider-connection state, the primary **Collect Opportunities** control, and a small text-led agent status without making the student scroll past a large introductory panel to reach the collection. The pixel character supports this status; it must not consume more attention than the current opportunities. Put detailed completed-run metrics in a compact, expandable latest-run area rather than repeating the same result in the agent-status panel and a second large block.

For the hosted student Site, give the workbench a cooler, more contemporary undergraduate tone: a crisp ink-and-cool-neutral foundation, vivid but restrained teal/cyan accents, succinct action-oriented copy, and a few playful details. Keep opportunity evidence and next steps more prominent than decoration; maintain readable contrast and reduced-motion support.

On wider screens, let the agent-status panel fill the workbench height beside the setup and collection controls, avoiding an empty gap below it. Keep its current message near the top so an expanded student-setup form does not push the status out of view. On narrow screens, return to a compact stacked panel.

## Current internship collection

Display the collection as a scannable, full-width row list on larger screens and a readable stacked layout when space is limited. Keep it synchronized with the local spreadsheet.

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

In the hosted Site, a **Preliminary fit** indicator should appear for each evidence-ready opportunity beside—not instead of—the recommendation and evidence bullets. Show the rounded 0–100 score, TypeSafe/Jev attribution, and a short explanation that it reflects evidence alignment, not a hiring probability. Show **Score unavailable** with a specific reason when source or profile evidence is insufficient or scoring fails; a failed required score makes that update partial and offers a retry. Show **Needs reassessment** when the saved score belongs to an older evidence version or student setup. Never imply that a higher score authorizes an application or changes the student's decision. A score-only refresh does not generate a material-update email.

In the hosted Site, display current, valid preliminary scores from high to low by default. Put unscored, stale, failed, or other-profile records after scored records and label their status; never treat an unavailable score as zero. Offer a **Recently reviewed** alternative. Sorting changes only the dashboard view, not recommendations, spreadsheet rows, or operational history. Use a stable secondary order for equal scores.

The student should be able to search, filter, sort, and open an opportunity without losing the current dashboard context.

On wider screens, present the current opportunities as concise, full-width rows rather than two simultaneously expanded columns. Each row should expose the company and role, location or arrangement, recommendation, current preliminary-score state when available, a short evidence-based reason, the next action or exact missing-information cue, and an obvious **Apply** link. Selecting **Review details** opens one focused opportunity panel while the ordered collection remains in place. The panel holds the complete rationale, bullet lists of verified matches and gaps, posting evidence, student response, Word drafts, and interview practice. Keep only one opportunity panel open at a time; closing it should return keyboard focus to its originating row. On narrow screens, the same detail panel should occupy the available width without horizontal scrolling. Do not widen or rearrange a row when opening its details.

The summary row and its detail panel must identify the same opportunity. Do not truncate away the only actionable question or hide the only response path; when student input is needed, surface that state in the row and show the exact question beside **Update Opportunity** in the detail panel. Preserve existing human approval, source-link, score-qualification, and draft-review language.

Do not show a separate dashboard-wide **Information needed to continue** box that repeats the selected-opportunity or opportunity-row content. Show an input-needed cue on the affected row and put the full question, response status, and **Update Opportunity** control together in that opportunity's detail panel. The selected-opportunities area may summarize the same opportunity immediately after a run, but it should link the student to that single actionable record rather than create a second response surface.

## Reset Collection experience

Provide a secondary **Reset Collection** control near the current collection. It should be visually distinct from **Collect Opportunities** and unavailable while a workflow is active.

Selecting it must open a confirmation dialog that explains exactly what will happen:

- the active opportunity spreadsheet will be reinitialized with zero opportunity rows;
- opportunity-related operational memory, run history, application-material drafts, and notification previews will leave the active collection;
- the prior private runtime data will be copied to a dated local reset archive for recovery;
- saved student context, the notification recipient, API configuration references, and the local daily schedule will remain; and
- any notification already submitted through a future live provider cannot be recalled.

Require the student to enter `RESET` before enabling the final **Archive and Reset** action. After success, refresh all collection, run-summary, material, and activity views; show the archive location; and make the next **Collect Opportunities** action use the empty current collection and fresh opportunity-related memory.

## Collect Opportunities experience

Provide a prominent **Collect Opportunities** button.

Beside the button, remind students that opportunity matching may take about five minutes. Treat this as an approximate expectation, not a countdown or completion guarantee; continue to show actual elapsed time and meaningful progress while a run is active.

Place a **Student Setup** section before the collection control. It should show whether the active package is a **Confirmed real-student setup**, an explicitly selected **Synthetic demonstration setup**, or **Incomplete**. It must not silently activate synthetic defaults. The section should accept `.docx`, `.pdf`, `.md`, and `.txt` resume files up to 5 MB, upload them only to the loopback local controller, and explain that no external parsing service is used.

After local extraction, show an editable **Agent-facing profile preview**. The student must review it, remove direct identifiers, and explicitly confirm it before it becomes active. Uploading alone must not change the authoritative profile. Provide clear **Confirm and use profile**, **Replace file**, and **Deactivate private profile** controls. Deactivation returns to the synthetic demonstration profile without deleting or exposing private source files. Show extraction or validation failures next to this card and preserve the prior active profile.

Add a structured preference-and-constraint form beside or immediately below the resume controls. Require at least one selected preferred role, availability start and end dates, weekly availability, acceptable work arrangements, geographic boundaries, paid-internship preference, relocation flexibility, and work-authorization or sponsorship status. Provide **Unsure or prefer not to state** for work authorization and an optional additional-constraints field.

The default role choices are **AI Business Analyst Intern**, **AI Systems Analyst Intern**, **Business Process Automation Analyst Intern**, **AI Product Analyst Intern**, **Business Systems Analyst Intern**, **Data or Business Intelligence Analyst Intern**, and **AI Transformation or Technology Consulting Intern**. Present them as selectable choices rather than silently assuming all apply, require at least one intentional selection, and allow a custom role.

Provide a clearly separated **Use synthetic demonstration setup** control for classroom testing. Activating it requires an explicit student action and labels every resulting assessment as synthetic. Switching back to real-student setup must restore the real setup form without deleting confirmed private files.

In the hosted pilot, the confirmed real-student path is the primary setup path. Place synthetic demonstration as a smaller secondary option beside or below that path, never as an equally prominent primary action. When selected, keep the active **Synthetic demo** status obvious and preserve a clear way back to a saved real profile. The visual hierarchy must not silently select or disguise the demonstration mode.

Place the **Student notification email** control immediately above the **Collect Opportunities** button. It should explain that the address remains local and that the initial API version creates verified local notification previews after material updates. Do not imply that a preview was sent or request an email password, token, or provider credential.

The button's meaning should be explicit:

> Collect relevant internship opportunities now and process the strongest new or materially changed results.

Supporting text or an accessible description should make clear that **Collect Opportunities** starts the approved general-public-web-search and opportunity-processing workflow. It does not process pending student responses, submit applications, or contact employers.

Before enabling **Collect Opportunities**, require both a complete, explicitly selected student setup and a successful non-billable provider connection and configured-model access check. Do not label the runtime **ready** merely because a key file exists. Display the exact missing setup items beside the disabled control; do not use only a generic **Needs Attention** label. Display a plain-language, sanitized connection result such as **Connection verified**, **API key rejected**, **Model unavailable**, **Network unavailable**, or **Provider temporarily unavailable**. Provide a **Check connection** control that performs a fresh validation without generating content or searching the web. Keep model-supported actions disabled until both prerequisites are satisfied for the current local process.

When selected:

1. ask the local controller to begin the bounded production-agent workflow through the OpenAI Responses API;
2. retrieve the relevant current student search preferences;
3. perform bounded public-web discovery and collect a limited candidate pool;
4. validate, deduplicate, and cheaply filter candidates before detailed reasoning;
5. rank the remaining candidates and select the top three to five relevant new or materially changed opportunities when at least three qualify;
6. complete the detailed workflow only for the selected opportunities;
7. visibly indicate that a run is active;
8. prevent an accidental simultaneous duplicate run;
9. show high-level progress;
10. refresh the dashboard when the run finishes; and
11. show whether spreadsheet and notification-preview actions succeeded.

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

For a substantive information or confirmation response, show how OpenAI's scoped qualitative reassessment addressed the exact question, what remains unverified, and whether the required evidence-ready Jev score was refreshed, reused because scored evidence did not change, or remains unavailable with a reason. The student must explicitly consent before a screened non-identifying answer is sent to OpenAI. Jev receives only compact structured evidence for scoring; it never reviews the free-form answer or changes the recommendation. **Not interested** and **Unsure** choices need no model call or rescoring. Keep the score subordinate to the evidence-backed explanation and recommendation; the score cannot change a business decision on its own.

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

Examples include “Reading your verified role, location, timing, and work-authorization preferences,” “Requesting a bounded public-web search for Summer 2027 analyst internships in California,” “Validating eight structured candidates returned by the API,” “Adding Northstar Foods — Business Systems Intern to the local spreadsheet,” “Creating a Word cover-letter draft for Northstar Foods,” and “Saving three verified notification previews for your configured address.” Use a company, role, candidate count, file type, or action count only when it is present in observable runtime data. Do not imply access to hidden reasoning.

Avoid vague descriptions such as “Carrying out a permitted local action.” When low-level activity cannot be classified more precisely, say what approved resource is being read or what output is being prepared, and explicitly avoid claiming that a write or external action succeeded before verification.

Display an accessible progress bar and percentage derived from completed or reached workflow stages. Treat the percentage as an approximate stage-based indicator, not a prediction of remaining time. It must move forward monotonically during a workflow, reach 100% only after verification and memory completion, and never be fabricated from chain-of-thought or token activity.

Show the progress bar only while a workflow is active. After completion, move the verified outcome and duration to the latest-run summary and return the character panel to **Ready** or an explicit recoverable **Action required** state. Never show an idle **Waiting** state beside a stale 100% bar.

Do not display raw chain-of-thought, hidden reasoning, internal prompt text, or private scratch work. Show concise evidence, rationale, status, and observable outcomes instead.

### Runtime event mapping

Dashboard progress and pixel-character behavior must be grounded in observable controller milestones, API events, or verified business-tool outcomes. The controller may map events approximately as follows:

| Observable controller/API event or outcome | Dashboard state |
|---|---|
| Reading approved context or specifications | **Retrieving** |
| API web-search request or returned source activity | **Searching** |
| Structured candidate review, ranking, or fit-assessment activity | **Assessing** |
| Reading verified context, source rules, or prior state | **Retrieving**, naming the approved resource category being read |
| Spreadsheet add or update requested by the controller | **Updating Collection**, naming the affected opportunity when available |
| Word application-template generation | **Preparing Word Draft**, naming the opportunity and requested draft type when available |
| Notification preview creation or future provider submission | **Preparing Notifications** or **Sending Notifications**, accurately distinguishing preview from submission |
| Verification activity or an observable outcome check | **Verifying** |
| Successful workflow completion after required run-finalization work | **Finished** |
| Approval request or runtime failure | **Action required**, with the exact requested approval or recoverable action |
| Missing student information for a tracked opportunity | **Update [company and role]**, with the exact question and an **Update Opportunity** button |

A low-level event should be combined with the agent's explicit business-stage status when necessary; for example, generic tool activity alone does not prove that a spreadsheet update succeeded. The interface must not infer or expose hidden reasoning to create a more detailed animation.

### Run result summary

After each run, show a concise discovery summary derived from verified workflow results. For example:

```text
Today's Run

Searches performed:        6
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

## Daily schedule

The dashboard should let the student configure the optional once-per-day local schedule. Present a compact area such as:

```text
Daily Collection
Status:    Enabled
Schedule:  9:00 AM daily while this app is running
Timezone:  America/Los_Angeles
Last Run:  ...
Next Run:  ...

[Enable/Disable] [Change time]
```

Store schedule settings privately under `data/local/`. Show only values confirmed by saved configuration and verified run state. If a value is unavailable, display **Unknown** rather than infer it. Schedule controls must use the protected local mutation boundary and must not include credentials.

The dashboard should continue to provide **Collect Opportunities** independently of scheduling. Both triggers use the same search-and-processing workflow, confirmed student setup, duplicate-prevention rules, permissions, verification requirements, memory, and approval rules. Targeted **Update Opportunity** actions are separate, immediate, single-opportunity workflows and are not delayed until the schedule runs. Collection and targeted assessment remain disabled until student setup is complete.

Clearly explain that the initial scheduler runs only while the local application is active. If the computer or application was unavailable at the scheduled time, display **Missed Run** when the application next starts; never imply that the run occurred. Detailed behavior belongs in `runtime/local-schedule.md`.

The current hosted student Site has no Daily Run control. Collection starts only from **Collect Opportunities**. The removed GitHub Actions design is retained in `runtime/github-cloud-schedule.md` for possible future review, not as a current UI requirement. Never display an invented scheduled run. This does not change the local application's separate schedule controls.

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

Use a few restrained, cute motions: a brief idle blink or antenna movement, a small task-specific working motion, and a short check or sparkle after verified success. Motion should be short and should not cause cards, buttons, or text to jump. A failure or unresolved approval state uses a calm warning pose, not a celebration. Honor `prefers-reduced-motion` with static poses and identical text status; animation is never the only way to understand progress.

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

Before a run, show notification mode as **Local preview** for the initial API implementation. A configured address does not imply that a live email provider is connected.

Show:

- latest informational email status;
- the opportunity that triggered it;
- the material update summarized;
- preview creation time or future provider submission/delivery time when known; and
- whether the preview or future provider action succeeded, failed, or remains unknown.

Distinguish local preview creation, provider submission, and confirmed delivery. Do not display API keys, sender identity, provider credentials, tokens, or secret configuration.

The current hosted student Site sends no live email; state that plainly. A future separately approved per-student email group should show **Disconnected**, **Ready to notify**, **Submitted**, **Failed**, or **Outcome unknown** from verified state; it must not equate a saved recipient with authorization or request an email password. Provider acceptance is **Submitted**, not **Delivered**. When mail is not connected, preserve the material collection update and explain why no notification was sent.

Show separate, compact **Check OpenAI** and **Check Jev** controls near the hosted collection action. Each displays its own sanitized result and checks only the server-side provider configuration: OpenAI confirms configured-model access; TypeSafe resolves an available Jev release or alias through its authenticated model-list endpoint. Neither check generates content, scores an opportunity, exposes credentials, or treats a configured key as a successful connection. Both verified checks are required before hosted collection starts. Explain that a model-list check does not prove a later scoring request will succeed.

## Hosted student Site

The hosted dashboard must identify itself as a student-facing Site and show the actual deployment/data mode. Require sign-in and keep each student's setup, collection, drafts, downloads, and reset archives separate. Offer an explicitly selected synthetic demonstration profile as a secondary option; label its assessments synthetic. Real setup requires student confirmation. Do not copy the owner's pilot records into a student's account or show sample opportunities as results of a failed live run. Follow the audience and usage safeguards in `runtime/codex-sites-student-release.md`.

Show a timestamped **Download current spreadsheet** control only when an `.xlsx` generated from verified hosted current records is available. Do not show **Open local spreadsheet** or a laptop path. Label hosted capabilities according to their verified state. Do not show a Daily Run setup or status panel while cloud scheduling is removed; leave the corresponding local-app controls unchanged.

Once hosted Reset Collection is verified, place its secondary control beside the hosted collection download. Explain that it archives only the signed-in student's current opportunities, related history, responses, and Word drafts before clearing that student's active collection; it keeps student setup, server-side secrets, and earlier reset archives. Require the student to type `RESET` and prevent reset during another workflow. After success, refresh the current collection and run/activity views and show that student's private archive download with its creation time. Retain archives until that student explicitly deletes them. An archive download supports recovery, but the dashboard must not imply that one-click restore is available.

Live hosted email is disabled for the student release. If a later, separately approved per-student email group is implemented, status must distinguish a verified collection update, an attempted send, provider acceptance, unknown outcome, and independently confirmed delivery. The pixel character may show **Sending Notifications** only during an actual send attempt and must not celebrate an unconfirmed outcome.

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

- tailored resume draft using the supplied PDF as a visual layout reference, with proposed changes highlighted;
- complete, role-specific Cal Poly-inspired cover-letter draft; and
- application-question worksheet.

Prepared artifacts should be saved as professionally formatted Microsoft Word `.docx` files and appear in the opportunity details with type, creation time, unresolved placeholders or verification notes, and a **Download Word draft** action. A tailored resume must retain the full confirmed original resume content and integrate small, verified role-specific edits in place; do not replace it with only selected excerpts. Restore section and bullet boundaries when extracted PDF text is run together, and highlight only proposed edits against unchanged text. A privately retained original resume may be used only for its owner's draft and must be deletable; a PDF-to-Word conversion may retain content without identical layout, and the UI should disclose that. The cover letter must contain complete draft paragraphs based on the posting's recorded duties and qualifications, not an outline. If a paragraph's only validation gap is an absent evidence citation for a student claim, save it with an unmistakable unverified label in that paragraph plus separate student verification notes; show those notes in the opportunity's materials area. Never silently turn an unsupported claim into an application-ready fact. Use editable placeholders for contact details absent from the non-identifying profile; never borrow identity or claims from another person's reference file. Every document and dashboard record must say **Draft template — student review required**. Raw Markdown must not be the student-facing saved artifact. The dashboard must never offer **Submit application**, automatic form completion, employer upload, or a control that makes a template appear final.

## On-demand interview practice

Show **Practice Interview** as a separate button on each tracked opportunity, not as a checkbox inside **Prepare materials**. It runs only after the student clicks it; neither **Collect Opportunities** nor a daily run prepares interview questions automatically. During the scoped run, show plain-language progress such as checking the selected role, searching for reported questions, searching for interview-process information, checking source support, preparing the practice set, and verifying the Word draft. Run two distinct search themes when available, with an optional third gap-filling search, within three calls and ten inspected public results per click independently of the collection budget. Show the actual search count and a clear incomplete-research message if a search fails.

Display four clearly separated groups: **Publicly reported questions** with clickable source links, publication date when available, and exact-role or related-role labels; **Reported interview process** with the same provenance and candidate-report versus employer-guidance labels; **Likely practice questions** explicitly marked as agent-generated; and **General process preparation** explicitly marked as non-employer-specific. When no candidate report or employer-specific process is verified, say so instead of inventing details. Do not make a source link or video title look like proof of an exact question or interview stage when the underlying content was unavailable. Include these distinctions in the position-specific **Download interview practice Word draft**, show when it was researched, and warn when the opportunity or student setup has changed since preparation.

Use shape as well as color and wording to distinguish action families: a prominent solid rectangular **Collect Opportunities** control, a clearly outlined **Update Opportunity** control, a softer rounded **Prepare materials** control, a distinct pill-shaped **Practice Interview** control, and an unmistakable external **Apply** link. Keep hover, keyboard-focus, disabled, and narrow-screen states readable; do not rely on shape or color alone to convey authority. On wider desktop screens, let the dashboard grow beyond its current narrow maximum width while preserving comfortable text line lengths and the existing responsive mobile layout. Opening **Prepare materials** or **Practice Interview** must not make an opportunity card jump to full-row width.

This action must not change the current opportunity decision, preliminary fit score, spreadsheet record, or notification status. A failed search or document save remains visible with a specific retry action; it is not reported as a completed practice set.

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
- **Practice Interview**
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

For the hosted Site's visual refinement, retain the existing teal identity while shifting the surrounding palette toward cool neutrals, deep ink, and limited lively accent color. Reduce repeated heavy borders and shadows. Use a clear type hierarchy, generous but economical spacing, one dominant primary action at a time, and gentle hover/pressed feedback. Preserve the distinct shapes and names of Collect, Update Opportunity, Prepare materials, Practice Interview, and Apply. Verify the ready, active, partial, failed, awaiting-input, and completed views at desktop and narrow widths before publication; a visual redesign must not change workflow behavior, stored data, model-call limits, or authority boundaries.

## Future implementation boundary

This specification does not prescribe a frontend framework. The implementation must connect through the local workflow controller to the OpenAI Responses API, keep the API key server-side, use the local schedule specification, and preserve these accessibility, synchronization, and human-authority boundaries.
