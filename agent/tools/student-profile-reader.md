# Student Profile Reader Tool Specification

## Tool name

**Student Profile Reader**

## Purpose

Read verified student information from `context/` for internship assessment. This document specifies a future capability; it does not implement a profile reader.

## When the agent may use it

The agent may use this tool during **RETRIEVE** or **REASON** when a current opportunity requires specific student evidence, preferences, availability, or constraints.

## Required inputs

- Requested information categories.
- Relevant files or snapshot references in `context/`.
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

Each item should retain its source, snapshot or version, review date, and verification state. Only explicitly supplied information may be returned as factual. Blank templates, examples, and inferred qualifications are not facts.

## Permissions

The tool may read approved local context files and return only information relevant to the current cycle. It may not edit the profile, upgrade a verification state, search for personal information elsewhere, or upload context to an external service.

## Failure behavior

Identify missing, stale, malformed, contradictory, or unverified information. Return the usable subset and the precise gap. If a missing fact affects eligibility or integrity, require student clarification rather than creating a default.

## Security considerations

Keep student context local, minimize personal information, and avoid returning contact details or identifiers unless essential. Do not place profile contents in logs, Git history, or external requests. Treat public-repository templates as non-factual.
