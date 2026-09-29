# Privacy and Security Policy

## Purpose

Keep student information, credentials, local runtime data, and external access appropriately limited throughout design, testing, and future operation.

## Secrets and credentials

- Do not expose credentials.
- Do not place passwords, tokens, or API keys in specification files.
- Keep secrets outside GitHub in a local secret store or ignored local configuration.
- Keep the student recipient setting local.
- Load `OPENAI_API_KEY` only in the local server process from an operating-system environment variable or ignored local configuration.
- Never expose an API key in browser code, prompts, API responses, logs, memory, spreadsheet data, or the frontend.
- Keep any future email-provider credentials in an approved local secret store; do not copy passwords or OAuth tokens into repository files or user-facing runtime data.
- Do not expose secrets through the frontend, logs, errors, spreadsheet cells, or operational memory.
- Redact sensitive values before displaying diagnostics.

For the owner-only Sites pilot, configure `OPENAI_API_KEY` separately as a server-side Sites secret; do not read or copy the protected local key file into a deployment. Microsoft Graph authorization must use the owner's interactive delegated flow and keep OAuth material in approved protected server-side storage. Never place either credential in Sites source assets, environment examples with values, browser storage, spreadsheet exports, logs, or operational memory. Verify owner-only access before enabling hosted secrets or private persistence.

Optional hosted Jev scoring uses a separate server-side Sites secret, `JEV_API_KEY`, solely for TypeSafe AI at `api.typesafe.ai`. Transfer only a compact, non-identifying summary of verified matches, gaps, preferences, constraints, and evidence completeness. Do not transfer the original resume, name, email, contact details, application materials, raw student response, full posting, or free-form private constraints. Keep the key, request body, and raw provider response out of browser assets, logs, spreadsheet exports, and operational memory. A scoring failure must not block the opportunity's qualitative assessment.

## Student and test data

- Avoid collecting or displaying unnecessary personal information.
- Use synthetic or explicitly approved student data during testing.
- Retrieve only the student context relevant to the current opportunity or run.
- Minimize retention of information that is no longer operationally necessary.
- Do not infer or expose sensitive personal attributes that are not required for internship operations.

## Local runtime data

- Keep profile details, memory, drafts, and operational records local by default.
- Store student-uploaded resumes and extracted profile previews only under Git-ignored local runtime storage. Never copy a personal resume into the tracked synthetic `context/` files.
- Store student-entered preferred roles, availability, geographic boundaries, work-arrangement choices, and constraints under the same Git-ignored local student-context area. Treat them as stable context, not operational memory or spreadsheet content.
- Extract supported resume files locally. Do not send an original resume to an external parsing service.
- Require the student to review and confirm an editable, non-identifying agent-facing profile before it is used as authoritative resume evidence.
- Never include the original resume file, direct contact details, or unconfirmed profile text in model requests. Send only the minimum confirmed evidence needed for the active task.
- For student-requested tailored resume and cover-letter drafting, send only relevant confirmed, non-identifying profile excerpts to the configured OpenAI API. Do not send the original resume or the supplied visual-reference PDF; do not publish personal resume content or generated private drafts to GitHub.
- Never send work-authorization details, free-form private constraints, or resume evidence in public-web search queries. Use only the minimum non-identifying role, timing, broad location, and work-arrangement criteria needed for discovery.
- For on-demand interview-question search, use only the employer, role, and public posting details. Do not send the student's resume, name, contact information, eligibility, private answers, or free-form constraints in a public query. Save structured question evidence and source links rather than full social posts, transcripts, or handles.
- Allow an **Unsure or prefer not to state** work-authorization value. Preserve the resulting uncertainty and request clarification only when a specific opportunity makes the fact consequential.
- Do not commit the local runtime spreadsheet when it may contain personal or evolving application data.
- Store the spreadsheet and runtime state under the repository's `data/local/` folder, which must remain excluded from Git.
- Provide local controls for export, retention, backup, and deletion. A collection reset must explain its scope, require explicit confirmation, archive the prior private runtime data locally for recovery, and leave the archive excluded from Git.

## Owner-only hosted pilot data

The hosted pilot is an **additional deployment**, not a migration of `data/local/`. Its first checkpoint uses synthetic student context only, does not accept a real resume, and does not copy existing local opportunities or settings. Label live postings assessed against the synthetic profile as synthetic assessments. Real-student upload and profile storage require a later explicit consent, retention, deletion, and isolation design before activation.

Use durable private hosted storage for current opportunity records, operational memory, settings, and notification attempts. Keep current records separate from detailed history and make the user-facing spreadsheet a verified current export. A hosted reset must remain unavailable until an owner-scoped downloadable archive of affected records and Word bytes is created and checked by read-back. Retain reset archives until the owner explicitly deletes them; never include the student setup, credentials, or prior archives in the active-collection reset. Do not use ephemeral deployment files as durable records or include private runtime data in a source archive.

The Site must remain owner-only. A student-accessible or public version requires a separate access and per-student isolation review. The owner's OpenAI key must not be exposed to visitors or silently shared with a class.

The owner has removed the optional GitHub Actions cloud Daily Run from the current hosted Site. Do not reactivate its workflow or trigger using retained credentials. The deferred design in `runtime/github-cloud-schedule.md` would require separate secrets, minimum data transfer, and fresh approval and verification before any future use. Historical private schedule metadata may be retained for compatibility, but it is not an active control or authorization.

## External services

Use only student-approved services and transfer the minimum necessary information. Apply least-privilege access, validate destinations, and record material external transfers. Never bypass service access controls.

Routine student notifications should use minimum non-identifying disclosure: opportunity facts, decision, deadline, and next action may be included, but resume evidence, student responses, legal-eligibility information, and unrelated context should not be sent. The owner-only hosted pilot may send those messages through separately authorized Microsoft Graph delegated `Mail.Send` only to the connected owner's confirmed address, after a verified material update. A provider `202 Accepted` is submission, not delivery. Application templates remain local in the local app; hosted review-only downloads require their own verified private-storage implementation and must never be sent to an employer.

## Security failures

If a credential may be exposed, data may have been sent without authority, or local data integrity is uncertain, stop the affected action, preserve non-secret diagnostic evidence, inform the student, and require remediation before resuming.


