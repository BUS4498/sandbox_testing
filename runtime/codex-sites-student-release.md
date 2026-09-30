# Codex Sites Student Release

## Relationship to the private pilot

This release converts the existing hosted Internship Prep Desk into a student-facing Site. The earlier [private-pilot specification](codex-sites-private-pilot.md) records the design and acceptance history; this document governs the changed audience. The local app remains a separate local-first option. The hosted Site does not read a student's laptop files except an upload the student explicitly selects, and it does not inherit the local app's spreadsheet, credentials, or schedule.

## Audience and identity

The Site may be reachable by anyone with its link, but every dashboard and API route must require ChatGPT sign-in before exposing or changing student data. Public access to the URL is not anonymous access to the application. The server obtains the stable authenticated user identity from Sites; no browser field, URL, model output, or request body may select another user's identity. Every current opportunity, reviewed profile, original resume, student response, run, event, Word draft, spreadsheet export, and reset archive must be scoped to that identity. The existing owner's pilot records remain under the owner's identity and must not be copied into new students' accounts.

Before widening access, test signed-out denial and two distinct signed-in identities against read, write, download, reset, and archive paths. A student must not see, modify, download, or reset another student's records, even with a guessed record ID. Keep all visitors as viewers, not Site editors; editors can inspect the Site's data. If identity forwarding or isolation cannot be verified, do not widen access.

## Student setup and privacy

Each student explicitly chooses a real setup or clearly labeled synthetic demonstration. For a real setup, require reviewed, confirmed, non-identifying profile evidence and preferences before Collect. Parse the chosen resume in the browser. Retain the original file privately only after that student's separate opt-in, and allow that student to delete it. Send only the minimum confirmed, non-identifying evidence to OpenAI for matching and only the compact approved assessment projection to TypeSafe/Jev for scoring. Explain these transfers before the student starts a billable run. No student profile, resume, draft, spreadsheet, archive, or operational record belongs in Git or public assets.

The current hosted implementation does not send live email and does not run automatically. Keep both states explicit; widening access does not authorize a shared Outlook sender, student email transport, or Daily Run.

Reset remains scoped to the signed-in student's active collection. Keep its verified recovery archive until that student explicitly deletes it, but limit retained archives to five per student; require the student to download and deliberately delete an older archive before creating a sixth. Do not delete usage-admission history during reset.

## Shared provider keys and usage ceilings

The owner supplies OpenAI and TypeSafe/Jev keys as Sites server-side secrets. Never expose them to the browser or visitors. Owner-funded classroom use is subject to server-enforced, durable, atomic admission limits measured over a rolling 24-hour window:

- Collect: at most **one start per signed-in student** and **50 starts across the Site**.
- Other workflow starts: at most **ten targeted updates**, **five Word-draft preparations**, **two interview-practice requests**, and **two fit-score backfills per student** in a rolling 24 hours. Across the Site, these secondary starts share a ceiling of **100** in a rolling 24 hours. Some fixed-rule updates may not call a model, but are counted conservatively so the endpoint cannot bypass the limit.

Apply limits before the first external model request. A model call already started counts even if its result fails, times out, or is interrupted. Preflight failures before a model call should not consume a slot when this can be verified. Show a plain-language limit message and when the student may try again. A limit must be enforced by the server and durable storage, not by a disabled browser button alone. The owner should also configure provider-side spend alerts or hard limits; application quotas are a secondary safeguard, not a monetary guarantee.

Maintain the existing per-run limits of ten internship web searches, fifteen candidates, and five selected updates. Matching may take about five minutes; present that as an approximate expectation beside Collect while showing actual progress and elapsed time. Do not promise a five-minute deadline.

## Release verification

Before switching audience, verify current source and deployment identity, authentication, cross-user isolation, usage ceilings under concurrent requests, record persistence, reset/download scope, secret non-disclosure, and the signed-in student journey with a synthetic profile. Recheck on the live Site after publication. Do not run billable collection solely for release testing without specific authorization. Preserve the owner's existing records and keep a rollback path to restricted access if a defect appears.
