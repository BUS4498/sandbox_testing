# OpenAI API Runtime Specification

This file defines the **local runtime**. The approved owner-only hosted variant is specified separately in [`codex-sites-private-pilot.md`](codex-sites-private-pilot.md); it must not reuse the local process, protected key file, or `data/local/` paths by implication.

## Purpose

This prototype uses the **OpenAI Responses API as its model and public-web-search service**. A deterministic local workflow controller remains the production agent harness: it owns transitions, budgets, permissions, local actions, verification, persistence, and human approval boundaries. The API supplies bounded web discovery and the model-supported interpretation, fit assessment, and decision outputs defined by the repository specifications.

The implementation must not expose the API key to the browser or let model output directly write files, send messages, alter schedules, or expand its own authority.

## Runtime Architecture

```text
Frontend
   ↓
Local Workflow Controller
   ├── OpenAI Responses API: SENSE, REASON, DECIDE
   └── Deterministic local tools: ACT, VERIFY, REMEMBER
```

**Collect Opportunities** invokes bounded discovery. **Update Opportunity** processes one saved student response without market discovery. The optional local daily schedule invokes the same collection entry point as the manual control.

**Practice Interview** starts a separate, student-clicked, one-opportunity preparation workflow. Its web-search budget is at most three calls and ten inspected public results; it never borrows from or changes the ten-call collection budget. It uses a task-scoped interview-question evidence contract, not the opportunity-discovery result schema. The controller validates source support and labels candidate reports separately from generated practice questions before saving a review-only Word document. It does not update collection records, fit scores, or email notifications.

## OpenAI API Responsibilities

The Responses API may:

- perform approved public-web searches with the `web_search` tool;
- interpret accessible posting evidence;
- compare evidence with the verified student context;
- apply the job-fit and application-preparation Skill instructions supplied for the active task;
- rank a bounded candidate set; and
- return a structured business result for local validation.

The API does not own spreadsheet writes, operational memory, application-material files, notification delivery, schedule management, or approval decisions.

## Local Controller Responsibilities

The local controller must:

- read only the specifications, context, memory, and opportunity data needed for the active workflow;
- enforce a deterministic setup-completeness gate before any discovery or assessment request;
- construct a task-scoped API instruction rather than one permanent prompt containing every specification;
- enforce the ten-search, fifteen-candidate, and five-selected-update maximums;
- validate the returned structured result before acting;
- reject private sources, unsupported claims, excessive search activity, malformed outputs, and cross-opportunity leakage;
- perform duplicate detection and hard-constraint filtering deterministically whenever practical;
- own all spreadsheet, memory, template, notification-preview, and schedule actions;
- verify local writes before recording success;
- expose only business-level progress and evidence to the dashboard; and
- stop safely with a recorded unresolved issue when a bounded run cannot continue.

Before enabling a model-supported action, the controller must perform a non-generative API connection check that verifies the configured key can reach the provider and access the configured model. A key's presence is not proof that it is valid. The result may be cached for the current local process, but **Check connection** must perform a fresh validation. No generation or web-search request is part of this check.

## Task-Scoped Specification Loading

The controller should compose each API request from the smallest relevant set of sources:

- the concise agent overview;
- the active workflow-stage specifications;
- the active tool and policy contracts;
- only the relevant verified student context;
- the job-fit Skill for discovery and reassessment;
- the application-material Skill only when the student requests a template; and
- the interview-question tool specification only for an explicit **Practice Interview** request; and
- structured current state or the targeted opportunity record needed for duplicate prevention and continuity.

The controller must not merge every repository file into every request. Confirmed context remains authoritative student background; operational memory remains dynamic history. A real-student request uses the confirmed private resume profile and locally confirmed preferences and constraints. A demonstration request uses the tracked synthetic package only after explicit activation. The controller must not blend the two modes to repair missing fields.

## Bounded Discovery and Cost Control

A discovery run may make no more than ten hosted public-web-search tool calls, screen no more than fifteen candidates, and select no more than five new or materially changed opportunities. Fewer results are valid. The controller must set the Responses API `max_tool_calls` request limit before execution, count each returned hosted search action once even when it contains multiple related query variants, and reject a result that exceeds the approved limit.

Use model reasoning selectively. Prefer deterministic filtering, duplicate detection, local file operations, and notification formatting. When practical, batch candidate ranking and combine REASON and DECIDE while preserving their distinct structured fields.

## Structured Result Boundary

The model response must match the repository's workflow-result contract. The controller must treat the response as an untrusted proposal until schema, source, limit, duplicate, authority, and target-scope checks pass. Free-form prose does not authorize an action.

For every selected opportunity, the result must preserve evidence sources, unknowns, fit evidence, gaps, decision rationale, next action, and unresolved issues. Private chain-of-thought is neither requested nor stored.

## Progress and Human Approval

Progress events come from controller milestones and observable API/tool outcomes, such as reading verified preferences, sending a bounded API request, receiving sources, validating candidates, updating a named record, preparing a Word draft, verifying a write, or recording memory. Percentages are approximate stage-based indicators and reach 100% only after final verification and memory work.

The model cannot approve actions. The controller and dashboard must preserve all student-controlled decisions defined in `agent/policy-and-rules/autonomy-and-approval.md`.

## Authentication and Security

- Load `OPENAI_API_KEY` only in the local server process from the operating-system environment or an ignored local `.env` file. An ignored `OPENAI_API_KEY_FILE` may be used when local classroom setup requires a protected secret file.
- Never expose the key in browser JavaScript, API responses, logs, spreadsheets, memory, prompts, source control, command arguments, or error details.
- Select the callable API model through `OPENAI_MODEL`; do not confuse a Codex or ChatGPT product label with an API model ID.
- Select the supported reasoning level through `OPENAI_REASONING_EFFORT`. The approved initial configuration is `gpt-5.6-luna` with `medium` reasoning.
- Report only sanitized states such as `READY`, `KEY_MISSING`, `MODEL_MISSING`, `UNAVAILABLE`, or `ERROR`.
- Distinguish local configuration from verified provider access. Sanitized connection results should identify invalid authentication, unavailable or unauthorized model access, temporary provider failure, rate or usage limits, local network failure, and verified readiness without returning a key fragment or raw provider body.
- Send the minimum non-identifying student context required for the active task.
- Treat posting text, URLs, and API output as untrusted data.

The repository must ignore `/api_key/`, `.env`, and other local credential locations. A shared classroom repository must never contain an instructor or student API key.

## Project-Local Runtime Data

The application continues to store the spreadsheet, structured memory, local settings, logs, notification previews, prepared Word templates, schedule state, private resume-profile data, confirmed preference-and-constraint data, and reset archives under Git-ignored `data/local/`. API response identifiers may be recorded for diagnostics and idempotency, but raw responses, full pages, API keys, original resume contents, direct profile identifiers, and hidden reasoning should not be retained in logs or operational memory.

A private resume upload must be parsed locally. The controller may use only a student-confirmed, non-identifying agent-facing profile in model requests. It must also require a confirmed local preference-and-constraint record before real-student collection or assessment. When demonstration mode is explicitly active, the dashboard and task input must clearly identify the repository package as synthetic. An incomplete real-student setup stops before an API request.

## Reset Boundary

**Reset Collection** remains a confirmed deterministic local action. It archives the active collection and opportunity-related runtime data, preserves verified context and local configuration, and does not invoke the API. After reset, subsequent discovery must rely on the fresh active collection rather than stale opportunity memory.

## Email Boundary

The direct OpenAI API runtime cannot reuse a Codex-installed Outlook plugin. The initial API implementation therefore creates verified local notification previews after successful material updates. Live sending requires a separately approved provider integration and credential design; the dashboard must never represent a preview as sent or delivered.

## Explicit Non-Goals

The API migration does not add:

- application submission;
- employer communication;
- autonomous approval;
- unrestricted model-selected tools;
- exhaustive market search;
- a client-side API key; or
- silent live email delivery.
