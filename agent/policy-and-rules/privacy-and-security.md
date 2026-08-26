# Privacy and Security Policy

## Purpose

Keep student information, credentials, local runtime data, and external access appropriately limited throughout design, testing, and future operation.

## Secrets and credentials

- Do not expose credentials.
- Do not place passwords, tokens, or API keys in specification files.
- Keep secrets outside GitHub in a local secret store or ignored local configuration.
- Keep the student recipient setting local.
- Keep Outlook authentication inside Codex-managed connector storage; do not copy Outlook credentials or OAuth tokens into this repository, local settings, memory, spreadsheet data, or the frontend.
- Do not expose secrets through the frontend, logs, errors, spreadsheet cells, or operational memory.
- Redact sensitive values before displaying diagnostics.

## Student and test data

- Avoid collecting or displaying unnecessary personal information.
- Use synthetic or explicitly approved student data during testing.
- Retrieve only the student context relevant to the current opportunity or run.
- Minimize retention of information that is no longer operationally necessary.
- Do not infer or expose sensitive personal attributes that are not required for internship operations.

## Local runtime data

- Keep profile details, memory, drafts, and operational records local by default.
- Do not commit the local runtime spreadsheet when it may contain personal or evolving application data.
- Store the spreadsheet and runtime state under the repository's `data/local/` folder, which must remain excluded from Git.
- Provide local controls for export, retention, backup, and deletion. A collection reset must explain its scope, require explicit confirmation, archive the prior private runtime data locally for recovery, and leave the archive excluded from Git.

## External services

Use only student-approved services and transfer the minimum necessary information. Apply least-privilege access, validate destinations, and record material external transfers. Never bypass service access controls.

Routine student notifications should use minimum non-identifying disclosure: opportunity facts, decision, deadline, and next action may be included, but resume evidence, student responses, legal-eligibility information, and unrelated context should not be sent. Application templates remain local unless the student separately authorizes a specific external action.

## Security failures

If a credential may be exposed, data may have been sent without authority, or local data integrity is uncertain, stop the affected action, preserve non-secret diagnostic evidence, inform the student, and require remediation before resuming.
