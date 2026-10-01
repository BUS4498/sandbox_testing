# Student Profile Reader Tool Specification

## Tool name

**Student Profile Reader**

## Purpose

Read verified student information for internship search and assessment from one explicitly selected, complete setup package: a real local student setup or the repository's labeled synthetic demonstration context.

## When the agent may use it

The agent may use this tool during **RETRIEVE** or **REASON** when a current opportunity requires specific student evidence, preferences, availability, or constraints.

## Required inputs

- Requested information categories.
- The active setup mode and confirmation status.
- For real use, a student-confirmed, non-identifying resume profile and confirmed local preference-and-constraint record under private runtime storage.
- For demonstration use, an explicit student selection of the synthetic files or snapshot references in `context/`.
- Run ID and the opportunity or decision requiring the information.
- Verification and review metadata when available.

## Expected output

A scoped profile package that may include:

- education;
- coursework;
- skills;
- experience;
- projects;
- career preferences;
- availability; and
- constraints.

Each item should retain its source type, snapshot or version, review date, and verification state. Only explicitly supplied and confirmed information may be returned as factual. Blank templates, examples, unconfirmed uploads, and inferred qualifications are not facts.

The output must identify whether the active education, skills, projects, and experience evidence came from:

- a **Private confirmed resume profile**; or
- the **Synthetic demonstration profile** in `context/is-junior-resume.md`.

Career preferences and availability constraints retain their separately identified sources and must not be presented as facts extracted from the resume.

For a real student setup, the confirmed local preference-and-constraint record must include:

- at least one preferred internship role;
- internship availability start and end dates;
- weekly availability;
- acceptable work arrangements;
- geographic boundaries;
- paid-internship preference or requirement;
- relocation flexibility;
- work-authorization or sponsorship status, including an allowed **Unsure or prefer not to state** value; and
- any optional additional constraints the student chooses to provide.

The dashboard should offer these role choices by default without assuming that every role applies: **AI Business Analyst Intern**, **AI Systems Analyst Intern**, **Business Process Automation Analyst Intern**, **AI Product Analyst Intern**, **Business Systems Analyst Intern**, **Data or Business Intelligence Analyst Intern**, and **AI Transformation or Technology Consulting Intern**. The student must intentionally select at least one role. The local form may accept a custom role. In the hosted setup, the [Resume Role Suggestions tool](resume-role-suggestions.md) offers a resume-driven dropdown and explicit **Add role** action instead of free-text additional-role entry. Suggestions remain advisory until the student adds and saves them; preserve previously saved additional roles.

## Permissions

The tool may read the active confirmed private profile, confirmed local preference-and-constraint record, and approved demonstration context files and return only information relevant to the current cycle. It may not edit the profile, select a setup mode, confirm an upload or setup form on the student's behalf, upgrade a verification state, search for personal information elsewhere, or upload the original resume to an external parsing service.

The local application may accept `.docx`, `.pdf`, `.md`, or `.txt` resume files up to 5 MB. It must extract text locally, create an editable agent-facing preview, and require explicit student confirmation before that preview becomes the active resume evidence. Uploading a file alone does not make its contents authoritative.

The first owner-only Sites checkpoint uses only the explicitly selected synthetic demonstration context. It must not read a local private profile through the Site, copy a prior `data/local/` profile, or present real-resume controls as active. A later hosted real-student group requires its own consent, secure extraction and storage, confirmation, retention, and deletion design before this tool may return hosted real-student evidence.

## Failure behavior

Identify missing, stale, malformed, contradictory, unconfirmed, or unverified information. Before collection or assessment, return an incomplete-setup result with the precise missing fields rather than a partial profile. A failed extraction or invalid setup update must preserve the prior confirmed package and show a recoverable error. If a missing fact affects eligibility or integrity, require student clarification rather than creating a default.

## Security considerations

Keep the original upload, extracted preview, confirmation record, active private profile, and confirmed preference-and-constraint record under Git-ignored local runtime storage. Do not place profile contents in logs, Git history, spreadsheet rows, notification messages, or public assets.

Before activation, the student must review the agent-facing preview and remove direct identifiers such as name, email address, phone number, street address, and personal profile URLs. The system should apply deterministic contact-detail reduction where practical, but student confirmation remains required because automated redaction is not guaranteed to find every identifier.

Only the minimum confirmed, non-identifying evidence relevant to the current task may be included in a model request. The original file must never be placed in a model request or sent to an external parsing service. Treat public-repository templates and unconfirmed uploads as non-factual.
