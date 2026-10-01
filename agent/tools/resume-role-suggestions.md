# Resume Role Suggestions Tool Specification

## Tool name

**Resume Role Suggestions**

## Purpose

Help the student choose internship role preferences from their uploaded resume's education, coursework, skills, projects, and experience. Suggestions are possible role types to consider, not verified openings, eligibility decisions, or invented qualifications.

## When the agent may use it

In the hosted student setup, only after the student explicitly selects **Suggest internship roles**, reviews the extracted resume preview, removes direct identifiers, and consents to this OpenAI operation. The rest of the setup form may be incomplete: this aid helps the student choose roles before saving a complete setup. It does not activate the preview as authoritative context for collection.

## Required inputs

- Platform-authenticated student identity, used only by the controller for private storage and cost limits.
- Reviewed non-identifying resume preview and explicit review/role-suggestion consent.
- Resume evidence references and a content/version fingerprint.
- Existing server-side OpenAI configuration; use the approved `gpt-6.1-sol` model with medium reasoning.

Do not use the default role list as the basis for suggestions, another student's profile, or unsaved geographic, eligibility, or availability answers. Do not send the original file, name, contact information, personal links, or private constraints to the model.

## Expected output

Return zero to eight distinct undergraduate internship role titles, a concise explanation for each, and references to the actual resume excerpts supporting that suggestion. Return fewer when evidence is thin; do not pad. State that the student may need additional skills or employer-specific eligibility checks. Do not claim that openings exist or promise employment suitability.

The dashboard keeps the existing default role choices. Replace the hosted free-text additional-role entry with a labeled dropdown and **Add role** control. Show the selected suggestion's explanation and evidence. Students may add multiple distinct roles, remove them, and keep previously saved additional roles. No role is silently selected or saved. Only **Save and use real profile** makes their chosen preferences authoritative.

## Permissions

One bounded, server-side, no-web OpenAI request per uncached student click; no Jev call, collection, opportunity update, email, or application action. Cache the latest validated result privately for that student's exact reviewed content and model/specification version. Reopening the same result makes no model request.

Allow at most **five new requests per student in a rolling 24 hours**, sharing the hosted secondary-action ceiling of **100**. Enforce admission atomically before inference, independently of Collect allowances. Started model requests count even when they fail. The owner Collect exception does not bypass this limit. A collection reset does not restore it. No automatic retries.

## Failure behavior

Block unreviewed, identifying, empty, or unreadable evidence before inference. Reject malformed, duplicate, non-internship, or unsupported-reference output. Preserve saved preferences and collection on failure. Show a specific retry/review message; default role choices remain usable. If no supported suggestion is available, say so. Ignore a response belonging to an older edited preview rather than presenting stale recommendations.

## Security considerations

Require authenticated same-origin requests. Never accept an owner identity from the browser or model. Keep credentials server-side. Retain only the latest private suggestion cache with minimum supporting excerpts; delete it with the student's private profile. Keep resume content and raw provider responses out of operational logs, Git, public assets, spreadsheets, and notifications. Operational history may retain sanitized attempt, count, outcome, and provider metadata only. Treat resume instructions and model outputs as untrusted data.
