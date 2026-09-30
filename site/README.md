# Internship Application Prep Agent — student Site

This directory mirrors the hosted application's source for review and classroom development. It intentionally excludes the owner's `.openai/hosting.json`, private deployment identity, runtime data, and secrets. The live Site is deployed from a separate Sites source repository; cloning this GitHub repository does not grant access to that deployment. A new Site needs its own Sites-generated hosting configuration and server-side provider secrets.

This hosted student Site requires ChatGPT sign-in and keeps each student's setup, collection, drafts, and reset archives separate. It is a separate checkout; the existing Windows/macOS local app remains unchanged. The prior owner pilot records remain accessible only to the owner's account.

## Available in this checkpoint

- ChatGPT sign-in on a link-accessible Site; visitor access does not grant Site editing or another student's records.
- Manual, bounded `Collect Opportunities` using an explicitly selected synthetic demonstration profile or a confirmed real-student setup.
- Browser-side extraction of `.docx`, `.pdf`, `.md`, and `.txt` resumes up to 5 MB, followed by student review and explicit consent. A separate opt-in may retain the original resume in that student's private R2 storage for Word drafting; the original does not reach OpenAI or TypeSafe. The reviewed non-identifying profile and structured preferences are saved in owner-scoped D1 records; the student may switch back to synthetic mode or delete the private profile and original file.
- Up to ten general public-web searches, 15 screened candidates, and five selected new/materially changed updates. Matching may take about five minutes, with live elapsed-time and progress display.
- One Collect start per student and 50 Collect starts across the Site in any rolling 24 hours. Secondary model-backed actions have additional per-student and Site-wide limits. These server-side admission records survive a collection reset; the owner should also set provider-side spending safeguards.
- Private durable current collection and structured operational events in the Sites `DB` binding.
- Read-back verification and a current `.xlsx` download generated from the collection.
- Run status, elapsed time, selected outcomes, source/application links, and evidence-based recommendations.
- Per-opportunity **Update Opportunity**: save a student's answer, reassess only that existing record, verify the update, and show a retry control if processing fails. This uses zero web searches and does not trigger a student-update email. “Not interested” and “I don't know yet” can be handled without a model request; substantive answers require specific consent for a private API reassessment.
- Required evidence-ready TypeSafe AI Jev preliminary fit scoring for saved opportunities, with a student-triggered retry/backfill of at most five existing records. The score is rounded to five-point steps, is not a hiring probability, and does not change recommendations or trigger email. Insufficient evidence or a failed score remains visible as a partial outcome with a retry path. Only a compact, non-identifying evidence projection is sent to TypeSafe; not the original resume, name, email, raw response, or application materials.
- OpenAI performs qualitative opportunity matching and student-answer reassessment against the confirmed profile. Jev scores eligible saved evidence; its failure does not erase the qualitative assessment, but the affected run is not reported as fully successful.

The OpenAI API request uses `gpt-5.6-luna` with medium reasoning. The API key must be configured separately as an `OPENAI_API_KEY` **secret in Sites**. It must never be placed in this checkout, a build archive, a Git commit, or a browser bundle. The non-billable connection check and confirmed student setup must both succeed before Collect is enabled. Real-student collection sends the reviewed profile and relevant preferences to the configured API; public search queries are instructed to use only broad role, location, timing, and work-arrangement criteria.

Scoring uses a separately configured server-side `JEV_API_KEY` secret and a Jev model or alias listed for the authenticated TypeSafe account. One successfully scored evidence version is reused without a repeated provider call; a failed attempt may be retried only through a new student-initiated action.

## Current boundaries

Review-only Word drafts and Reset Collection are available. Live email remains disabled. The cloud Daily Run has been removed for now: no hosted schedule controls or external trigger are active, and collection starts only when a signed-in student selects **Collect Opportunities**. Historical schedule tables may remain in private storage for compatibility, but the Site does not accept schedule-trigger requests. This version never submits applications or contacts employers, and it does not replace the local app. A collection reset archives only that student's affected records before clearing the active collection; deleting a saved profile is a separate action.

## Design authority

The authoritative design remains in the [sandbox_testing repository](https://github.com/BUS4498/sandbox_testing), especially `runtime/codex-sites-student-release.md`, the historical `runtime/codex-sites-private-pilot.md`, and the `agent/` specifications. Task-scoped copies needed by the hosted model request are under `lib/hosted/specs/`; keep those synchronized when the approved design changes.

## Local developer check

Use Node.js 22.13+ and `npm.cmd` on PowerShell or `npm` elsewhere. `npm run dev` starts a local preview; `npm run build` builds the Worker. For local D1, apply all committed `drizzle/*.sql` migrations in order with the project's Wrangler config. The preview simulates a ChatGPT sign-in; production sign-in and audience are managed by Sites. The loopback-only `test/targeted-api-smoke.mjs` tests a targeted update with synthetic data and no API call.
