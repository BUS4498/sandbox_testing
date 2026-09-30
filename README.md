# Internship Application Prep Agent

> **Current status:** The local prototype uses a deterministic workflow controller with the OpenAI Responses API for bounded reasoning and general public web discovery. It provides a local dashboard, spreadsheet and memory operations, actionable student-response controls, review-only application-template preparation, local scheduling, and verified notification previews after material updates. Application submission and employer communication are not capabilities of this system.

> **Hosted Site status:** The [Internship Prep Desk student Site](https://internship-prep-desk.nicole-ai-lab.chatgpt.site/) is accessible by link but requires ChatGPT sign-in for each student's private workspace. Owner-funded usage is limited to one Collect start per student and 50 Site-wide Collect starts per rolling 24 hours. Opportunity matching may take about five minutes. Live email and cloud Daily Run remain disabled. The hosted Site is separate from the local application and its local-only scheduler.

## What this project is

The Internship Application Prep Agent is a local-first prototype for an undergraduate student searching for internships. It helps collect, evaluate, prioritize, and track opportunities; request and process missing student information; and prepare review-only application templates while keeping consequential career decisions under the student's control.

The application runs on the student's computer and provides a local browser-based dashboard. A local spreadsheet at `data/local/internship_pipeline.xlsx` serves as the student's user-facing collection of current internship opportunities. The surrounding `data/local/` folder also holds operational memory, local settings, notification previews, schedule state, and prepared templates and is excluded from Git. After a material collection update succeeds, the initial API version creates a deterministic local notification preview for the recipient chosen in the dashboard. It does not claim that a preview was sent.

The agent can also prepare formatted Microsoft Word `.docx` drafts: a role-tailored resume with proposed changes highlighted, a complete Cal Poly-inspired cover letter, or an application-question worksheet. A separate, student-clicked **Practice Interview** action researches publicly reported interview questions and process information for one saved opportunity and labels generated preparation guidance separately. These artifacts require student review and cannot submit an application.

Before collection or assessment, the dashboard requires one explicitly selected, complete student setup. For real local use, the student confirms a resume in `.docx`, `.pdf`, `.md`, or `.txt` format plus preferred roles, internship dates, weekly availability, work arrangements, geographic boundaries, paid-role preference, relocation flexibility, and work-authorization or sponsorship status. Extraction occurs locally, and the student must review a non-identifying agent-facing preview. Private resume and setup data remain under Git-ignored `data/local/student-profile/`; they are never committed to the repository or sent to an external parsing service. A labeled synthetic demonstration setup is available only after the student explicitly selects it.

## Opportunity sources

The agent is designed to obtain internship opportunities in two ways:

1. **Student-supplied postings:** the student provides a job-posting URL, pasted posting text, or another approved input.
2. **General public web search:** the student selects **Collect Opportunities**, or an enabled local daily trigger invokes the same workflow while the application is running, to discover current public internship postings through the Responses API web-search tool.

The design uses general public web search and does not require a dedicated or specialized job-search API. Web discovery gathers candidate opportunity information; the later workflow stages remain responsible for fit assessment, decisions, permitted collection updates, verification, and memory.

Discovery uses an approved prioritized source portfolio: employer postings hosted by Greenhouse, Lever, or Ashby; Simplify and the SimplifyJobs Summer 2027 GitHub list; USAJOBS Student Opportunities; CalCareers Student Employment; and Built In. Publicly accessible LinkedIn, Indeed, and Wellfound listings are lower-priority discovery fallbacks. The agent does not sign in to those services or bypass access controls, and it attempts to verify secondary listings against employer-controlled postings when reasonably possible.

The system is designed to support both:

- a student-initiated **Collect Opportunities** action;
- an immediate, single-opportunity **Update Opportunity** action after the student supplies requested information; and
- an optional once-per-day local schedule.

The controller validates structured API results before deterministic local `ACT → VERIFY → REMEMBER` operations. The normal discovery objective is the top three to five sufficiently relevant new or materially changed opportunities when at least three qualify. Returning fewer than three requires a visible shortfall reason; the agent never adds weak or invalid postings just to fill the result.

## Production workflow

`RETRIEVE → SENSE → REASON → DECIDE → ACT → VERIFY → REMEMBER → REPEAT OR STOP`

Detailed responsibilities for each stage are defined in the workflow task specifications.

## Core concepts

- **Context:** relatively stable background information supplied to the agent.
- **Memory:** dynamic operational information accumulated through agent activity.
- **Spreadsheet:** the user's visible collection of current internship opportunities.
- **Frontend:** the human interaction layer.
- **Tools:** capabilities that allow the production agent to access information or perform actions.
- **Runtime:** the deterministic local workflow controller and its bounded Responses API adapter.

## Specification navigation

- [Production agent overview](agent/agent.md)
- [OpenAI API runtime architecture](runtime/openai-api-runtime.md)
- [Owner-only Codex Sites pilot design](runtime/codex-sites-private-pilot.md)
- [Codex Sites student-release design](runtime/codex-sites-student-release.md)
- [Hosted Site source mirror](site/README.md) — application source and tests without the owner's Sites deployment identity or credentials
- [Local daily-schedule specification](runtime/local-schedule.md)
- [Workflow task specifications](agent/workflow-task-specs/)
- [Tool specifications](agent/tools/)
- [Internship Web Search tool specification](agent/tools/internship-web-search.md)
- [On-demand Interview Question Search tool specification](agent/tools/interview-question-search.md)
- [Student Email Notification tool specification](agent/tools/email-notification.md)
- [Optional Jev fit-scoring tool specification](agent/tools/jev-fit-scoring.md)
- [Local Application Materials tool specification](agent/tools/local-application-materials.md)
- [Policies and rules](agent/policy-and-rules/)
- [Memory specifications](agent/memory/)
- [Synthetic student context](context/)
- [Job-fit-assessment production Skill](agent/skills/job-fit-assessment/SKILL.md)
- [Application-material-prep production Skill](agent/skills/application-material-prep/SKILL.md)
- [Local frontend design](frontend/frontend-design.md)
- [Runtime-data guidance](data/README.md)

## Implementation boundary

Implementation proceeds from these specifications. The local controller owns workflow transitions, budgets, deterministic tools, verification, memory, and approvals; it uses the Responses API only for the approved model-supported stages. The implementation preserves the defined approval boundaries: the agent is an internship-management assistant, not an autonomous job applicant.

## Current development commands

The controller requires Node.js 22 or newer. Run `npm install` once to install the official OpenAI JavaScript SDK and local document-extraction dependencies. Copy `.env.example` to the ignored `.env` file, set an approved `OPENAI_MODEL` and supported `OPENAI_REASONING_EFFORT`, and never commit the populated file. Supply the key through `OPENAI_API_KEY`, or keep one key in the ignored `api_key/openai_api_key.txt` file documented by the template. The approved initial model configuration is `gpt-5.6-luna` with `medium` reasoning. API access and billing are separate from ChatGPT or Codex sign-in. `npm run check:api` performs a non-generative model-access check; it creates no response and performs no web search.

After that one-time setup, Windows users can double-click **Start Internship App.cmd** and macOS users can double-click **Start Internship App.command**. The launcher starts the local server only when needed, waits for its health check, and opens the dashboard in the default browser. It does not rely on PowerShell or `npm.ps1`. If the dashboard is already running, it simply opens the existing local page. Launcher diagnostics are written to the ignored local file `data/local/logs/launcher.log`.

- `npm test` runs the local controller, persistence, notification-preview, dashboard, schedule, and integrated-workflow tests with synthetic data and mocked API responses. It makes no live model, web-search, email, or employer request.
- `npm run check:api` validates the presence of a key and model using sanitized local configuration. It does not print the key or perform a billable model request.
- `npm start` starts the browser dashboard on `http://127.0.0.1:4318`. The dashboard binds only to the local computer. Its model-supported actions require valid local API configuration and internet access.
- `npm run launch` provides the same health-checked launcher behavior from a terminal when desired.

By default, active local files are stored under `data/local/` in this project folder. The dashboard displays the resolved folder and spreadsheet path. `INTERNSHIP_AGENT_DATA_DIR` may be set in an ignored local `.env` file only when another local storage location is intentionally required.

The dashboard requires both complete student setup and a non-billable provider connection and configured-model access check before enabling model-supported actions. It shows exact missing setup fields and provides a **Check connection** action for fresh validation. A configured key is not labeled ready until provider access is verified. **Collect Opportunities** performs bounded web discovery. **Update Opportunity** processes newly supplied information for one tracked opportunity immediately, without launching discovery or requiring a later collection run. Scheduled runs use the same setup gate and are skipped visibly when setup is incomplete. **Reset Collection** archives the active local collection and starts a fresh one only after explicit confirmation; it does not remove context, API configuration, notification-recipient settings, private profile configuration, or schedule configuration. Keys, credentials, raw provider responses, and private errors are not returned to the browser.

No billable live API discovery run is part of the automated test suite. Run one bounded live validation only after the exact API model has been approved and local configuration passes `npm run check:api`.

The test suite exercises structured local memory and spreadsheet operations in temporary directories. It verifies the 10-search/15-candidate/5-update limits, structured-result validation, duplicate prevention, optimistic record versions, read-back confirmation, student-owned field protection, notification idempotency, failure recording, and formula-injection-safe spreadsheet text. These tests do not create a persistent internship collection.

Student update notifications use exact deterministic plain-text messages. The initial API runtime writes private local previews and records them as `PREVIEWED`, not sent or delivered. Live email requires a separately approved provider integration.

The current hosted student Site has live email disabled. The earlier owner-pilot design considered a separate Microsoft Graph Outlook authorization; that proposal does not enable email for students or make a Codex Outlook plugin available to the Site. The Site uses separately configured server-side OpenAI and Jev secrets; the ignored local key file and `data/local/` are never copied to hosting. The student release limits owner-funded runs and keeps each signed-in student's data separate.

The dashboard receives observable controller, API, and local-tool milestones and presents only business-level states. The interface does not request or display private chain-of-thought.

The frontend uses a compact operational-workspace layout that prioritizes the current collection, verified run results, next actions, and attention states. Its supplemental pixel agent uses distinct observable animations for retrieval, web search, candidate review, ranking, fit assessment, local actions, collection updates, notifications, verification, memory, completion, and attention states. Reduced-motion settings replace those animations with static state poses.

For the local installation, the API key remains server-side and is read only from the environment or ignored `.env`; each student needs independently authorized local API access. In the hosted Site, the owner funds bounded student runs with Site-held secrets. Those keys are never distributed with the repository or browser assets.

