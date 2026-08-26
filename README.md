# Internship Application Prep Agent

> **Current status:** The local prototype uses Codex App Server for agent execution, general public web discovery, and connected-app access. It provides a local dashboard, spreadsheet and memory operations, actionable student-response controls, review-only application-template preparation, and Outlook student notifications after verified material updates. Application submission and employer communication are not capabilities of this system.

## What this project is

The Internship Application Prep Agent is a local-first prototype for an undergraduate student searching for internships. It helps collect, evaluate, prioritize, and track opportunities; request and process missing student information; and prepare review-only application templates while keeping consequential career decisions under the student's control.

The application runs on the student's computer and provides a local browser-based dashboard. A local spreadsheet at `data/local/internship_pipeline.xlsx` serves as the student's user-facing collection of current internship opportunities. The surrounding `data/local/` folder also holds operational memory, local settings, notification records, and prepared templates and is excluded from Git. After a material collection update succeeds, a deterministic message may be submitted through the Outlook Email app connected in Codex. The recipient is chosen in the dashboard; Outlook credentials remain in Codex.

The agent can also prepare formatted Microsoft Word `.docx` draft templates such as a resume-tailoring checklist, cover-letter outline, or application-question worksheet. These artifacts require student review and cannot submit an application.

## Opportunity sources

The agent is designed to obtain internship opportunities in two ways:

1. **Student-supplied postings:** the student provides a job-posting URL, pasted posting text, or another approved input.
2. **General public web search:** the student selects **Collect Opportunities**, or an enabled Codex daily automation returns to the approved thread and triggers the same discovery workflow, to discover current public internship postings.

The design uses general public web search and does not require a dedicated or specialized job-search API. Web discovery gathers candidate opportunity information; the later workflow stages remain responsible for fit assessment, decisions, permitted collection updates, verification, and memory.

Discovery uses an approved prioritized source portfolio: employer postings hosted by Greenhouse, Lever, or Ashby; Simplify and the SimplifyJobs Summer 2027 GitHub list; USAJOBS Student Opportunities; CalCareers Student Employment; and Built In. Publicly accessible LinkedIn, Indeed, and Wellfound listings are lower-priority discovery fallbacks. The agent does not sign in to those services or bypass access controls, and it attempts to verify secondary listings against employer-controlled postings when reasonably possible.

The system is designed to support both:

- a student-initiated **Collect Opportunities** action;
- an immediate, single-opportunity **Update Opportunity** action after the student supplies requested information; and
- an optional once-per-day Codex thread automation.

The controller integrates structured Codex turns with deterministic local `ACT → VERIFY → REMEMBER` operations. The normal discovery objective is the top three to five sufficiently relevant new or materially changed opportunities when at least three qualify. Returning fewer than three requires a visible shortfall reason; the agent never adds weak or invalid postings just to fill the result.

## Production workflow

`RETRIEVE → SENSE → REASON → DECIDE → ACT → VERIFY → REMEMBER → REPEAT OR STOP`

Detailed responsibilities for each stage are defined in the workflow task specifications.

## Core concepts

- **Context:** relatively stable background information supplied to the agent.
- **Memory:** dynamic operational information accumulated through agent activity.
- **Spreadsheet:** the user's visible collection of current internship opportunities.
- **Frontend:** the human interaction layer.
- **Tools:** capabilities that allow the production agent to access information or perform actions.
- **Runtime:** the Codex agent harness and the thin local-controller boundary that connect the dashboard to the approved agent specifications.

## Specification navigation

- [Production agent overview](agent/agent.md)
- [Codex runtime architecture](runtime/codex-runtime.md)
- [Codex daily-automation specification](runtime/codex-schedule.md)
- [Workflow task specifications](agent/workflow-task-specs/)
- [Tool specifications](agent/tools/)
- [Internship Web Search tool specification](agent/tools/internship-web-search.md)
- [Student Email Notification tool specification](agent/tools/email-notification.md)
- [Local Application Materials tool specification](agent/tools/local-application-materials.md)
- [Policies and rules](agent/policy-and-rules/)
- [Memory specifications](agent/memory/)
- [Synthetic student context](context/)
- [Job-fit-assessment production Skill](agent/skills/job-fit-assessment/SKILL.md)
- [Application-material-prep production Skill](agent/skills/application-material-prep/SKILL.md)
- [Local frontend design](frontend/frontend-design.md)
- [Runtime-data guidance](data/README.md)

## Implementation boundary

Implementation proceeds from these specifications. The local application connects its thin controller to Codex App Server; it does not build a second custom LLM runtime or dashboard-owned scheduler. The implementation preserves the defined approval boundaries: the agent is an internship-management assistant, not an autonomous job applicant.

## Current development commands

The controller foundation requires Node.js 22 or newer. Run `npm install` once to install the project-local official Codex CLI package, then authenticate Codex through the user's local Codex/ChatGPT sign-in and connect the Outlook Email app in Codex. The repository stores neither account credentials nor an OpenAI API key.

- `npm test` runs the local controller, persistence, notification, dashboard, and integrated-workflow tests with synthetic data and fake App Server/Outlook events. It makes no model, web-search, Outlook-send, or employer request.
- `npm run check:codex` launches Codex App Server, performs the initialization handshake, reads only the sanitized account-readiness state, and exits without starting a thread or model turn.
- `npm start` starts the browser dashboard on `http://127.0.0.1:4318`. The dashboard binds only to the local computer. Its **Collect Opportunities** and **Update Opportunity** actions require a locally executable, authenticated Codex CLI.

By default, active local files are stored under `data/local/` in this project folder. The dashboard displays the resolved folder and spreadsheet path. `INTERNSHIP_AGENT_DATA_DIR` may be set in an ignored local `.env` file only when another local storage location is intentionally required.

The dashboard checks Codex App Server readiness before enabling agent actions and provides a read-only **Recheck** action. **Collect Opportunities** performs bounded web discovery. **Update Opportunity** processes newly supplied information for one tracked opportunity immediately, without launching discovery or requiring a later collection run. **Reset Collection** archives the active local collection and starts a fresh one only after explicit confirmation; it does not remove context, authentication, notification-recipient settings, or Codex automation configuration. Account email, plan information, tokens, credentials, and raw process errors are not returned to the browser.

The live-validation run respected the approved funnel: three web searches produced 15 screened candidates and five selected opportunities. Local actions created five temporary workbook rows and five dry-run notification previews; the run correctly ended as `PARTIAL SUCCESS` because each selected opportunity retained an issue requiring student attention. No real email, application submission, or employer communication occurred, and no validation workbook is committed to the repository.

The test suite exercises structured local memory and spreadsheet operations in temporary directories. It verifies the 3-search/15-candidate/5-update limits, structured-result validation, duplicate prevention, optimistic record versions, read-back confirmation, student-owned field protection, notification idempotency, failure recording, and formula-injection-safe spreadsheet text. These tests do not create a persistent internship collection.

Student update notifications use exact deterministic plain-text messages and the connected Outlook app. The controller checks that the app is accessible, enabled, and callable and records completed Outlook sends as submitted rather than delivered. `DRY_RUN` remains available for tests and demonstrations and writes only private local previews.

The dashboard receives observable App Server events over the thin local controller and presents only business-level states. The controller opts out of raw reasoning and agent-message delta notifications; the interface does not display private chain-of-thought.

The frontend uses a compact operational-workspace layout that prioritizes the current collection, verified run results, next actions, and attention states. Its supplemental pixel agent uses distinct observable animations for retrieval, web search, candidate review, ranking, fit assessment, local actions, collection updates, notifications, verification, memory, completion, and attention states. Reduced-motion settings replace those animations with static state poses.

The controller first resolves the project-local Codex executable for Windows, macOS, or Linux and otherwise falls back to `codex` on the system path. For local troubleshooting, `CODEX_BINARY` may point to another accessible Codex executable for the current shell; it is not a credential and should not contain authentication data.
