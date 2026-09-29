# Codex Sites Private Pilot Specification

## Purpose and status

This is a **design for an owner-only hosted pilot**, not a claim that the existing local app has been deployed. The local-first application and its `data/local/` files remain intact. The hosted pilot must not silently copy local runtime data, secrets, resumes, or prior opportunities to Sites.

The first hosted checkpoint uses the explicitly selected **synthetic demonstration context** and a manual **Collect Opportunities** trigger. It may search live public postings, but every student-profile-based assessment must be labeled synthetic. Real-resume handling and automatic Daily Run are later hosted feature groups; until independently implemented and verified, their controls must say **Not available in this pilot** rather than imply they worked.

## Runtime boundary

```text
Owner-only browser dashboard
       ↓ authenticated requests
Hosted deterministic workflow controller
       ├── OpenAI Responses API: bounded discovery and model-supported assessment
       ├── private durable current collection and operational memory
       └── Microsoft Graph: approved student-only informational email
```

The hosted controller retains the same `RETRIEVE → SENSE → REASON → DECIDE → ACT → VERIFY → REMEMBER → REPEAT OR STOP` workflow, six-search/fifteen-candidate/five-update limits, task-scoped specification loading, duplicate checks, approval rules, and verification requirements as the local controller. The model may propose structured results but cannot write the collection, send mail, approve actions, or expand its own tool access. Hosted implementation must use only storage and server-side facilities actually supported by Sites; a local Node process or laptop filesystem is not an implicit dependency.

## Access and student data

- The Site must be owner-only before any private data or API secret is configured. Do not widen access to a class, group, or the public without a separate approved design and per-student isolation.
- The first checkpoint uses only the repository's synthetic student context. Do not upload, migrate, or process a real resume or an existing `data/local/` record in the hosted pilot.
- A later real-student group must define explicit consent, non-identifying profile confirmation, retention, deletion, and storage isolation before enabling real uploads. An original resume must not be sent to the OpenAI API or placed in Git/Sites source assets.
- Search queries must use only the minimum non-identifying role, broad location, timing, and work-arrangement criteria. Routine email must use minimum non-identifying disclosure.

## Durable collection and downloads

The hosted runtime must use durable private storage for current opportunity records, student-owned status/notes if later enabled, run state, action and evaluation history, notification attempts, and settings. Ephemeral process memory or a writable deployment filesystem is insufficient. Write the current record and read it back before a related email attempt. Maintain one current record per distinct opportunity; detailed process history belongs in separate operational memory.

In the hosted variant, the durable current records are the operational source of truth. Generate a current `.xlsx` download from those records as the **user-facing spreadsheet collection**; identify its generation time and record count. Do not present a stale export as synchronized. The local variant continues to maintain its authoritative `data/local/internship_pipeline.xlsx` file. Review-only `.docx` templates, when their hosted group is implemented, must be downloadable, tied to the correct opportunity, and verified before the dashboard reports success.

An on-demand **Practice Interview** group may use the hosted API's general public-web capability only after an owner click on one tracked opportunity. It has its own three-search and ten-inspected-result limits, private saved result and Word download, and source-supported labels that distinguish publicly reported questions from generated practice questions. It does not run during hosted collection, change the opportunity or preliminary fit score, or trigger mail. Existing hosted ownership and profile-mode safeguards apply; a later student-shared Site still requires a separate isolation review.

Hosted **Reset Collection** is an owner-initiated controller operation, never a model decision or a collection run. Before clearing any active data, create an owner-scoped downloadable archive of current opportunities, opportunity-related run/event history, student responses, Word-draft metadata and bytes; verify the archive by private storage read-back and checksum. Require a typed `RESET` confirmation, reject the request while another workflow is active, and clear the active collection only after archive verification. Preserve the student setup and server-side credentials. Show the archive's creation time, contents, and download control. Retain each private archive until the owner explicitly deletes it; a reset must not silently delete earlier archives. A failed archive or clear operation must remain visible without claiming success. No private runtime content belongs in source control or a deployment archive. An archived file is a recovery/export artifact, not an automatic restore operation.

## OpenAI configuration and cost

The owner may use the same authorized OpenAI API key as the local app, but must configure it separately as a **Sites server-side secret** named `OPENAI_API_KEY`. Never read or bundle the protected local key file for deployment. Keep `OPENAI_MODEL=gpt-5.6-luna` and `OPENAI_REASONING_EFFORT=medium` unless the user approves a change and the hosted connection confirms access. Do not expose any secret in browser assets, responses, logs, prompts, or Git.

The hosted owner bears API usage charges. Preserve the bounded discovery limits and add a visible run lock, sanitized provider failures, and a safe cost/spend-limit recommendation. A configured secret is not proof of connectivity; verify the model and web-search path through bounded tests before labeling them ready.

An optional secondary fit indicator uses TypeSafe AI System One/Jev through `https://api.typesafe.ai/v1/systemone` and a separate server-side `JEV_API_KEY`. Only compact non-identifying structured evidence may leave the Site for this purpose; the original resume, name, email, application materials, raw response, and full posting must not. The controller keeps the qualitative assessment and decision as the authority. It stores one current score or unavailable/stale status per opportunity with model, rubric, time, and evidence-version provenance; detailed attempts remain in operational memory. Score-only changes never create opportunity-update emails. A one-time backfill is limited to five eligible existing records and five provider calls; no record is scored merely to reach that count.

## Outlook notification transport

The hosted pilot uses Microsoft Graph with the owner's separately authorized Outlook account, not a Codex-installed Outlook plugin or the OpenAI API. Use an interactive delegated authorization flow with the minimum `Mail.Send` permission needed for `POST /me/sendMail`. The app must verify the connected account and permit pilot notifications only to that same confirmed address; it cannot become a general-purpose mail-sending endpoint. The owner may disconnect or disable notifications in the dashboard. OAuth credentials and tokens must stay in approved server-side secret or protected durable storage, never in Git, browser storage, spreadsheet, model input, or operational memory. If secure token storage or authorization cannot be established, keep live mail disabled and show the reason.

Compose routine messages deterministically from verified material changes. After a current-record write passes read-back verification, persist an idempotent send-attempt record **before** calling Graph. A successful `202 Accepted` means `SUBMITTED`, not `DELIVERED`; delivery requires separate evidence. A timeout, process interruption, or ambiguous provider response is `UNKNOWN` and must not be retried automatically. Store only non-secret attempt metadata and show the unresolved next action. Never send for duplicates, unchanged postings, invalid candidates, or filtered-out candidates; send at most five opportunity-update emails for one discovery run.

The first live mail test requires an explicitly approved self-addressed message and a verified material test update. Record Graph's outcome and ask the owner to confirm receipt separately. A local preview or mocked transport test is not a live send.

## Manual trigger and future schedule

For the first hosted checkpoint, **Collect Opportunities** was manual only. The local app's daily process timer is not a hosted scheduler. The separately approved GitHub Actions cloud trigger is specified in [`github-cloud-schedule.md`](github-cloud-schedule.md): it requires authenticated owner-scoped invocation, one attempt per local day, missed-run reporting, and tests proving that it uses the same collection entry point and policies. Keep hosted Daily Run disabled until its GitHub secrets and check-only invocation are verified. The local app's existing schedule remains local-only.

## Verification and release gate

Before reporting a hosted pilot as working, verify owner-only access, denial of unauthorized access, clean source/assets, secret non-disclosure, persistent record survival after reload and redeploy, valid spreadsheet download, actual bounded search and assessment on synthetic context, duplicate and error paths, and honest email states. Test Graph separately with the one approved self-addressed message. Site publication and original GitHub publication are separate outcomes; verify each destination independently.

