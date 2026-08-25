# Codex Repository Instructions

This repository defines and implements the Internship Application
Operations Agent.

The approved specification files are authoritative.

Before making implementation changes, read:
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
