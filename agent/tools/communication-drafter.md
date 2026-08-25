# Communication Drafter Tool Specification

## Tool name

**Professional Communication Drafter**

## Purpose

Prepare editable professional communication drafts, such as recruiter follow-up, interview confirmation, thank-you messages, and requests for clarification. The tool drafts only.

## When the agent may use it

The agent may use this tool after a decision recommends communication and the student has supplied or approved the relevant purpose, audience, and factual context.

## Required inputs

- Communication type and purpose.
- Intended recipient role or identity.
- Relevant opportunity and interaction facts.
- Verified student profile evidence when needed.
- Student instructions for tone, length, and timing.
- Prior approved correspondence when relevant.

## Expected output

An editable draft with a draft ID, communication type, proposed subject when applicable, exact body, factual sources used, unresolved placeholders, and a clear `DRAFT — NOT SENT` status.

## Permissions

The tool may read relevant approved facts and save a local draft. It may not send, post, upload, or otherwise deliver employer-facing communication. Sending requires the student's approval of the exact recipient and exact content through a separate authorized capability.

## Failure behavior

If recipient, purpose, relevant facts, or student intent is unclear, return a partial draft with visible placeholders or request clarification. Do not fill gaps with invented qualifications, relationships, dates, or prior interactions.

## Security considerations

Use only the minimum relevant personal and opportunity information. Keep drafts local until the student authorizes otherwise, exclude credentials and hidden tracking, sanitize imported text, and avoid exposing private correspondence in logs or Git.
