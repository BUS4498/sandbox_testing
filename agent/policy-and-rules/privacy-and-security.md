# Privacy and Security Policy

## Data posture

Store profile, memory, tracker, drafts, logs, and configuration locally by default. Collect and expose only the information needed for internship operations.

## Rules

- Keep credentials in a local secret store or ignored `.env`, never Markdown, logs, memory, spreadsheet cells, or Git.
- Keep generated spreadsheets and runtime data outside the repository.
- Treat public repositories as public: context files committed here remain templates, not real student records.
- Redact sensitive values from errors and dashboard diagnostics.
- Record external data transfer purpose, destination, and student authorization.
- Use least-privilege access and limit integrations to configured operations.
- Provide future export, retention, backup, and deletion controls.
- Do not infer or use protected personal characteristics for opportunity ranking.

## Retention

Retain provenance and audit records only as long as useful to the student and course purpose. Deletion should cover primary local records and known backups, while reporting any artifacts that could not be removed.

## Incident behavior

On suspected secret exposure, unauthorized transfer, or corrupted local data, stop affected actions, preserve non-sensitive diagnostic evidence, notify the student, and require remediation before resuming.

