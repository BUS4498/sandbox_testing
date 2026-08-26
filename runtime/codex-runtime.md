# Codex Runtime Specification

## Purpose

This prototype uses **Codex App Server as the production agent harness**. Codex supplies the model-driven runtime that executes the Internship Application Prep Agent. The specifications in this repository define the agent's business behavior, limits, tools, policies, memory, and reusable Skills.

This file defines the boundary between that harness and the local application. It is a runtime specification only; it does not implement the controller or launch Codex.

## Runtime Architecture

```text
Frontend
   ↓
Thin Local Controller
   ↓
Codex App Server
   ↓
Agent Specifications
```

For **Collect Opportunities**, the local controller launches or connects to Codex App Server, starts or resumes the approved internship-agent thread, submits the bounded discovery instruction, and translates runtime events into business-level dashboard updates. For **Update Opportunity**, it submits a separate scoped instruction that processes one newly saved student response immediately and prohibits discovery search. Codex daily automation owns the scheduled collection trigger described in `runtime/codex-schedule.md`.

## Codex App Server Responsibilities

Codex App Server serves as the production agent harness. Its responsibilities include:

- running the agent through thread and turn execution;
- providing model reasoning within the approved workflow and policies;
- making permitted Codex web and browser capabilities available for public-web internship discovery;
- executing permitted tools and workspace actions under the configured sandbox and approval policy;
- allowing the agent to read the repository's specifications and approved student context;
- starting, resuming, and reporting the state of agent threads and turns;
- exposing structured progress, completion, failure, and tool-activity events to the local controller;
- requesting and receiving user approval when an action requires it; and
- exposing locally managed Codex authentication, model discovery, and Skill discovery to the controller when needed.
- exposing installed-app discovery and callable state for the Outlook Email connector; and
- running a bounded Outlook connector turn that sends exact, already-composed student notifications after local spreadsheet verification.

The Codex harness must follow the workflow defined in `agent/agent.md` and load detailed guidance from the relevant workflow, tool, policy, memory, context, and Skill files instead of replacing them with one permanent all-purpose prompt.

## Local Controller Responsibilities

The local controller is a thin business-facing integration layer. It should:

- start and monitor the local Codex App Server process;
- complete the App Server initialization handshake;
- start or resume the approved internship-agent thread;
- submit either the concise approved **Collect Opportunities** instruction or the scoped **Update Opportunity** instruction, while leaving scheduled collection instructions and triggers to Codex automation;
- receive runtime events and map them to concise dashboard states;
- surface approval requests to the student and return the student's decision;
- connect permitted agent actions to the local spreadsheet, structured operational memory, and email helpers;
- confirm that Outlook is accessible, enabled, and callable before promising live delivery;
- provide the Outlook app mention when invoking the exact student-notification batch and observe completed connector calls;
- accept student next-action responses and preparation requests, preserve them locally, and immediately start a scoped update turn for the selected opportunity;
- save and verify review-only application templates in private local runtime storage;
- retain run identifiers and summaries needed to reconcile the dashboard with local state; and
- report recoverable failures, missed actions, and items needing student attention.

The controller must not duplicate Codex's model orchestration, reasoning loop, tool-selection loop, thread management, or model-routing responsibilities.

## Local Interface

For the initial implementation, the controller should launch Codex App Server as a local long-running subprocess and communicate through its default standard-input/standard-output transport. The protocol uses newline-delimited, bidirectional JSON-RPC-style messages.

The controller should:

1. send one `initialize` request and then the `initialized` notification;
2. start a new approved thread or resume its stored thread identifier;
3. start a turn containing the concise run instruction;
4. consume thread, turn, item, approval, and completion events until the turn finishes; and
5. shut down cleanly when the local application exits.

When verified material updates require student notification, the controller may start one bounded follow-up turn on the same approved thread. That turn should include the Outlook Email app mention and exact precomposed recipient, subject, and plain-text body values for no more than five messages. It is a connector-transport turn, not a second opportunity-reasoning pass, and it must not rewrite the messages.

The implementation should generate or consume a schema that matches the installed Codex version. Stable App Server methods should be preferred. Any experimental capability must be documented and isolated so that it can be replaced if the protocol changes.

## Specification Loading

The repository root should be the runtime workspace. `AGENTS.md` supplies repository-wide operating instructions. `agent/agent.md` is the concise high-level production-agent specification. Stage-specific, capability-specific, and policy-specific files remain separate and should be retrieved only when relevant to the current work.

This preserves the established distinctions among:

- **context:** verified, relatively stable student and environment information;
- **memory:** dynamic operational state and execution history;
- **tools:** permitted capabilities and their business contracts;
- **policies and rules:** authority, integrity, privacy, duplicate-prevention, and escalation limits;
- **Skills:** reusable production-agent capabilities such as job-fit assessment;
- **spreadsheet:** the student's current user-facing opportunity collection; and
- **frontend:** the human interaction layer.

## Project-Local Runtime Data

The local application stores its changing runtime files under `data/local/` in the project folder. This location contains the opportunity spreadsheet, operational memory, notification outbox, local settings, logs, and review-only application templates. The folder is excluded from Git and must never be committed or uploaded to GitHub.

The dashboard should display the resolved runtime folder and spreadsheet path. `INTERNSHIP_AGENT_DATA_DIR` may override the default location for an explicitly configured local installation, but it must not point to a committed location or contain credentials.

## Events and User Approvals

The controller may use Codex runtime events to show plain-English business progress and an explicitly approximate completion percentage. The percentage must be derived from reached workflow stages, not hidden reasoning or fabricated task counts. Status text should identify the observable object and operation whenever that information is available—for example, reading verified student preferences, validating a named posting, adding a named opportunity to the spreadsheet, creating a Word draft for a named opportunity, or submitting a specific number of student notifications. Avoid generic phrases such as “carrying out a permitted local action” when a safer, more concrete description is available. When student information is required, the interface should identify the affected opportunity, requested information, and **Update Opportunity** control instead of relying on a generic attention label.

## Fresh-start reset

The local controller may provide a student-initiated **Reset Collection** operation. This is not an agent decision and must not start a Codex turn. It must be unavailable while a workflow is active, require an explicit destructive-action confirmation, archive the prior private runtime collection locally for recovery, and then initialize an empty spreadsheet and empty opportunity-related operational memory.

Reset should also remove current application-material drafts and notification-preview history from the active collection. It must preserve the authoritative files under `context/`, the locally saved notification recipient, Codex/ChatGPT authentication, Outlook authentication, and Codex-managed automation configuration. Previously sent email cannot be recalled. After reset, the next collection run must start a new Codex thread so prior opportunity history is not silently treated as current state.

When Codex requests approval, the controller must show the student the proposed consequential action and enough information to make an informed decision. Existing authority rules remain controlling: Codex integration does not authorize application submission, employer communication, final material changes, or any other action reserved for the student.

Outlook app tool calls may produce a Codex `tool/requestUserInput` approval request. The controller must render the connector's business-level question and allowed answers, return only the student's selected answer, and never auto-approve a request that Codex or workspace policy requires the user to review.

## Authentication and Security Boundary

Codex authentication and Outlook connector authentication are owned by the user's local Codex installation and app connection. The repository must not copy Codex access tokens, ChatGPT credentials, Outlook passwords, or Outlook OAuth tokens into project files or local settings.

The controller must keep App Server communication local, use the repository's configured sandbox and approval policy, avoid exposing secrets in events or logs, and follow `agent/policy-and-rules/privacy-and-security.md`. Any necessary external disclosure must use the minimum non-identifying information sufficient for the approved task.

## Explicit Non-Goal

> Do not build a second custom LLM orchestration loop using the OpenAI Responses API. Codex provides the agent harness for this prototype.

The implementation effort should focus on the thin local controller, business-facing frontend, local spreadsheet and memory helpers, permitted email integration, and their connection to Codex App Server.
