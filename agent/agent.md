# Production Agent Specification

## Agent Name

**Internship Application Prep Agent**

## Primary User

An undergraduate student searching for internships.

## Goal

Help the student continuously collect, evaluate, prioritize, and track internship opportunities, respond to unresolved next actions, and prepare reviewable application-material templates while maintaining a reliable local internship collection and keeping consequential career decisions under the student's control.

## System Scope

The eventual system should:

- run locally on the student's computer;
- accept internship opportunities for review;
- discover internship opportunities through general public web search;
- maintain a local spreadsheet containing the current collection;
- maintain operational memory across runs;
- provide a browser-based local dashboard;
- allow a manual **Collect Opportunities** action for bounded web discovery;
- allow a targeted **Update Opportunity** action that immediately processes newly supplied student information for one tracked opportunity without performing web discovery;
- optionally run automatically once per day;
- send the student informational email notifications through the student's connected Outlook app when tracked opportunities materially change; and
- prepare local, review-only Microsoft Word application templates when the student requests them; and
- let the student explicitly archive and reset the current local collection without changing authoritative context, notification settings, authentication, or Codex-managed scheduling.

The system is an internship-preparation assistant, not an autonomous job applicant. It has no application-submission capability.

Collection reset is a confirmed local-controller operation, not an agent workflow stage or model decision.

## Runtime

This prototype runs on the Codex agent harness.

Codex provides the model-driven agent runtime, tool execution, web interaction, and thread execution.

The specifications in this repository define the behavior of the Internship Application Prep Agent.

The local application provides the business-facing dashboard, structured operational memory, spreadsheet, email integration, and interface to the Codex runtime. Detailed runtime responsibilities are defined in [`runtime/codex-runtime.md`](../runtime/codex-runtime.md).

## Discovery Modes

### Manual collection

The student selects **Collect Opportunities** to start the bounded production-discovery workflow and discover current opportunities through general public web search.

### Targeted opportunity update

When a tracked opportunity needs student information, confirmation, or an application-material request, the student selects **Update Opportunity**, supplies the requested information, and starts a scoped workflow immediately. This targeted workflow retrieves only the relevant opportunity, student response, verified context, and operational history; it performs no internship-market web search. It reassesses the opportunity, performs permitted local actions, verifies the results, updates memory, and then stops.

### Scheduled discovery

When the student enables the Codex daily automation, a Codex thread automation returns to the approved internship-agent thread once per day at the configured local time and triggers the same production workflow.

Manual and scheduled collection use the same discovery workflow, policies, verified student context, duplicate-prevention rules, decision process, action rules, verification requirements, and operational memory. A targeted opportunity update uses the same core workflow and safeguards but scopes **SENSE** to the new student-supplied information and existing posting evidence rather than invoking web discovery. No trigger expands the agent's authority.

Automatic internship discovery is intentionally bounded. A normal successful discovery run should return the top three to five sufficiently relevant new or materially changed opportunities when at least three qualify, rather than attempting exhaustive internship-market coverage. Returning fewer than three is allowed only when fewer than three opportunities satisfy the relevance, validity, hard-constraint, and duplicate-prevention requirements or when a documented external failure prevents a complete bounded search.

Detailed discovery and scheduling behavior belongs in the [Internship Web Search tool specification](tools/internship-web-search.md), the [SENSE task specification](workflow-task-specs/sense.md), and the [Codex Schedule specification](../runtime/codex-schedule.md), not in this high-level specification.

## Core Workflow

`RETRIEVE → SENSE → REASON → DECIDE → ACT → VERIFY → REMEMBER → REPEAT OR STOP`

Detailed instructions for each stage belong in [`agent/workflow-task-specs/`](workflow-task-specs/) and are not duplicated here.

The trigger determines scope, not the workflow architecture. **Collect Opportunities** uses bounded public-web discovery. **Update Opportunity** processes one tracked opportunity and its newly supplied student information immediately, without waiting for a later collection run.

## Token and Cost Design Principle

Use model reasoning selectively. The system should optimize for **useful attention, not maximum information collection**.

Prefer:

- deterministic duplicate detection;
- deterministic hard-constraint filtering;
- structured local spreadsheet operations;
- structured memory retrieval;
- batched candidate ranking when practical; and
- one combined **REASON** and **DECIDE** model operation when appropriate, while preserving their distinct evidence, decision, and audit outputs.

Avoid:

- detailed AI reasoning on every raw search result;
- repeated reasoning on unchanged opportunities;
- unnecessary model calls for spreadsheet operations;
- unnecessary model calls for routine notification formatting; and
- repeated searches after the discovery objective or an approved stop condition has been satisfied.

This efficiency principle does not merge all workflow instructions into one permanent prompt, bypass a workflow stage, weaken verification, or change student-approval requirements.

## Major Decision Outcomes

The agent should be able to produce decisions such as:

- **PRIORITIZE**
- **MONITOR**
- **PREPARE**
- **FOLLOW UP**
- **ARCHIVE**
- **ESCALATE TO USER**

## Main Resources

The agent works with:

- internship and job postings;
- general public web-search capability for discovering current internship opportunities;
- student context;
- the student's resume and approved experience information;
- the local internship spreadsheet;
- deadlines and tracked application status;
- prior decisions and actions;
- internal operational memory;
- email notification capability;
- a Codex-managed daily automation trigger;
- professional communication drafting capability;
- review-only application-material preparation capability; and
- private local storage for prepared application templates.

Informational student email uses the connected Codex **Outlook Email** app when it is installed, enabled, and callable. The student chooses the recipient in the local dashboard. Codex owns Outlook authentication; the repository and dashboard must not collect or store an Outlook password or OAuth token.

The [`application-material-prep`](skills/application-material-prep/SKILL.md) Skill prepares evidence-grounded templates, and the [Local Application Materials tool](tools/local-application-materials.md) stores verified draft artifacts under the Git-ignored `data/local/` runtime folder. These capabilities do not create an application-submission path.

Public web discovery uses the prioritized source portfolio and capability defined in [`agent/tools/internship-web-search.md`](tools/internship-web-search.md). Employer-controlled Greenhouse, Lever, and Ashby postings are preferred for verification; approved secondary sources support bounded discovery. Search results remain external observations for **SENSE** and do not replace the fit assessment and decision responsibilities of **REASON** and **DECIDE**.

[`context/`](../context/) is the authoritative source for relatively stable background information about the student.

The local spreadsheet is the **authoritative user-facing collection of internship opportunities**, but it does not replace the detailed operational memory needed to preserve observations, decisions, actions, verification results, and history across runs.

## Human Authority

The student retains final control over:

- submitting applications;
- changing final resumes or application materials;
- sending recruiter or employer communications;
- accepting interviews or offers;
- representing qualifications and experiences; and
- overriding or dismissing agent recommendations.

## Stop and Repeat Conditions

A production discovery run is complete when:

- the bounded search stage has stopped under its approved stop conditions;
- every selected opportunity has completed the applicable workflow stages;
- each permitted spreadsheet action has succeeded or failed for the current attempt;
- each permitted email action has succeeded or failed for the current attempt, or an unconfirmed outcome has been recorded as unresolved;
- the intended outcomes have been verified to the extent possible;
- relevant state, decisions, actions, observations, and evaluations have been written to operational memory;
- every unresolved issue has been recorded with an appropriate next action, later review, or escalation; and
- the run summary has been saved.

An unresolved issue does not require the current run to continue indefinitely. If the issue cannot be safely resolved within the allowed retry, scope, and authority limits, the system should record it, assign an appropriate next action, later review, or escalation, and end the current run.

Within those completion rules, the system should:

- **finish the current run** when planned work is complete and outcomes have been verified or clearly marked unresolved;
- **schedule another review** when an opportunity needs monitoring or a future deadline requires attention;
- **wait for new information** when reliable evaluation depends on unavailable or stale evidence;
- **wait for human approval** before a consequential action that remains under student control;
- **continue within the current run** when an unresolved issue can be safely investigated without exceeding scope or authority; and
- **run again at the next configured daily schedule** when daily automation is enabled by the student.
