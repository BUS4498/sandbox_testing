# Codex Repository Instructions

This repository defines and implements the Internship Application
Prep Agent.

The approved specification files are authoritative.

This project uses the OpenAI Responses API for bounded model reasoning
and public-web search. The deterministic local workflow controller is
the agent harness and owns transitions, budgets, local actions,
verification, persistence, and approval boundaries.

Do not implement:
- an unrestricted model-selected tool loop;
- client-side API-key handling;
- direct model writes to local operational data; or
- a custom multi-provider model-routing layer.

The local controller should integrate the business-facing frontend
with the Responses API and deterministic local tools. Runtime
responsibilities are defined under `runtime/`.

The initial API implementation creates local informational-email
previews. Do not claim that a preview was sent. Live email requires a
separately approved provider integration. Keep the student recipient
in private local settings and keep provider credentials out of Git.

The agent may prepare review-only application templates in private local
runtime storage. Do not add application submission, application-form
completion, automatic upload, or employer-contact behavior.

Before making implementation changes, read:
- runtime/openai-api-runtime.md
- runtime/local-schedule.md when changing automation or schedule-facing behavior
- agent/agent.md
- the relevant workflow task specification
- relevant tool specifications
- relevant policy/rule files
- relevant memory specification
- relevant production Skills
- frontend/frontend-design.md when changing the interface

Do not combine all workflow task specifications into one permanent
production-agent prompt. Load only the task instructions required
for the active workflow stage.

Keep:
- context separate from memory;
- spreadsheet state separate from execution history;
- production-agent Skills separate from tools;
- business rules separate from model reasoning.

Do not change approved specification files merely to accommodate
an implementation choice.

Never commit secrets or runtime personal data.

After implementing a component, test it before integrating the
next component.

Prefer a simple local-first, cross-platform implementation.

The separately approved owner-only Codex Sites pilot is defined in
`runtime/codex-sites-private-pilot.md`. Before changing or deploying its
implementation, read that specification in addition to the relevant
local specifications. Keep the local app operational; do not make its
filesystem paths or process timer appear to work in the hosted Site.
The first hosted checkpoint is manual-only and synthetic-context-only.
Never copy `data/local/`, a protected key file, or OAuth tokens into
Sites source, Git, or browser assets. The hosted Outlook transport needs
its own Microsoft Graph authorization; a Codex plugin session is not a
hosted-app credential. Report Graph acceptance as submission, not delivery.
