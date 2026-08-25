# Privacy and Security Policy

## Purpose

Keep student information, credentials, local runtime data, and external access appropriately limited throughout design, testing, and future operation.

## Secrets and credentials

- Do not expose credentials.
- Do not place passwords, tokens, or API keys in specification files.
- Keep secrets outside GitHub in a local secret store or ignored local configuration.
- Keep email credentials and recipient settings local.
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
- Store the spreadsheet and runtime state outside the Git repository.
- Provide future controls for local export, retention, backup, and deletion.

## External services

Use only student-approved services and transfer the minimum necessary information. Apply least-privilege access, validate destinations, and record material external transfers. Never bypass service access controls.

## Security failures

If a credential may be exposed, data may have been sent without authority, or local data integrity is uncertain, stop the affected action, preserve non-secret diagnostic evidence, inform the student, and require remediation before resuming.
