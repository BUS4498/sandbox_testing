# Codex Repository Instructions

This repository defines and implements the Internship Application
Prep Agent.

The approved specification files are authoritative.

This project uses Codex App Server as the agent harness.

Do not implement:
- a second custom LLM agent loop;
- a direct OpenAI Responses API model client; or
- a custom model-routing layer.

The thin local controller should integrate the business-facing
frontend with Codex App Server. Runtime responsibilities are defined
under `runtime/`.

Informational student notifications use the installed Codex Outlook
Email app. Do not add SMTP credentials, a second email provider, or a
direct provider API client. Keep the student recipient in private local
settings and keep Outlook authentication in Codex.

The agent may prepare review-only application templates in private local
runtime storage. Do not add application submission, application-form
completion, automatic upload, or employer-contact behavior.

Before making implementation changes, read:
- runtime/codex-runtime.md
- runtime/codex-schedule.md when changing automation or schedule-facing behavior
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
