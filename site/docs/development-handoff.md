# Development Handoff — Internship Prep Desk

Reconciled September 30, 2026. This reference covers the hosted student Site and its resume-role-suggestion feature. It does not replace the separate local application's operating instructions.

## System and scope

The dashboard helps signed-in students discover a bounded shortlist, assess fit, review Jev scores, answer opportunity-specific questions, and download review-only Word drafts. It never submits applications or contacts employers. Live email and Daily Run remain disabled. The audience stays link-accessible with ChatGPT sign-in; student records remain account-scoped.

The design authority is `BUS4498/sandbox_testing`, branch `material-drafts-publish`, including `agent/`, `frontend/`, and `runtime/codex-sites-student-release.md`. The hosted app is a separately managed Sites checkout; deployment and GitHub publication are different operations. Publication receipts and private test evidence remain in the maintainer's ignored build record, not in public assets.

## Architecture and boundaries

Browser dashboard → authenticated API/controller → bounded provider adapters → private D1/R2 → verified results and downloads.

- `app/student-setup.tsx`: browser-side resume extraction, editable non-identifying preview, review/consent controls, role dropdown and explicit Add/remove, final setup confirmation.
- `app/api/role-suggestions/route.ts`: authenticated GET/POST, same-origin writes, bounded input and safe error responses. The request never supplies an account identity.
- `lib/hosted/role-suggestions.ts`: one no-tool OpenAI request, structured result validation, private cache, operational run/event completion, no preference or opportunity mutation.
- `lib/hosted/role-suggestion-rules.js`: relevant excerpt selection, fingerprinting, zero-to-eight supported intern titles, evidence-ID checks, identifier/seniority rejection.
- `lib/hosted/role-suggestion-cache.ts`: latest result in R2 under a hashed authenticated owner key; exact profile/model/specification match; verified writes/deletion. Deleting the profile removes this cache; resetting opportunities preserves setup.
- `lib/hosted/collect-resumable.ts`: durable bounded discovery/review checkpoints, provider progress checks, source admission, exact-identity deduplication before private reasoning, permitted record writes, Jev scoring, verification and completion.
- `lib/hosted/store.ts` and `usage-policy.js`: account-scoped state, action locks, versioned read-back verification and atomic durable admission limits.
- `material-drafting.ts`, `material-draft-validation.js`, `resume-structure.js`, `word-drafts.js`: evidence-backed draft generation, full reviewed-text preservation, conservative in-place edits with selective yellow highlights, separate change log, Cal Poly-inspired letter and clearly marked unverified claims.
- `interview-practice.ts`: separate question/process searches; only source-supported reports are called reported questions/process. Generated alternatives are visibly labeled.

Context/profile inputs remain separate from dynamic runs, events, responses and evaluations. The hosted D1 collection provides one current record per distinct opportunity; the spreadsheet is an account-scoped export rather than a local runtime file. Original resumes and Word/recovery files live privately in R2.

## Models, configuration and limits

OpenAI Responses at `api.openai.com/v1/responses`, `gpt-6.1-sol`, medium reasoning: public discovery, private qualitative assessment/reassessment, role suggestions, materials and interview preparation. Role suggestions use no web/tool access, `store: false`, a strict result schema, 5,000 output-token ceiling and a 90-second timeout; no automatic retries. A suggestion has one to three references to the actual selected resume excerpts. Do not infer that these titles are open jobs or that a student meets their requirements.

TypeSafe/Jev at `api.typesafe.ai`: preliminary scoring only, using the existing compact non-identifying assessment projection. Never silently substitute OpenAI for Jev or overwrite a qualitative assessment because scoring failed. Insufficient evidence stays unavailable with an explanation and review/retry path.

Configure `OPENAI_API_KEY`, `JEV_API_KEY` and optional owner-pairing configuration only as server-side Sites secrets. No new keys are required by role suggestions. Original resumes, names, contact details and raw application materials never reach TypeSafe; only reviewed relevant non-identifying text reaches OpenAI. The original file is retained only with separate student opt-in.

Discovery: ten search actions, fifteen candidates and five selected material updates maximum; fewer useful results are allowed. Collect: five starts per student and sixty student starts site-wide per rolling 24 hours, with the separately verified owner exception. Role suggestions: five new starts per student, sharing the existing hundred-secondary-start site ceiling; cached reuse consumes no allowance and never affects Collect. Failure after admission still counts. Reset must not delete usage history. The owner Collect exemption does not extend to role suggestions.

## Operation and recovery

1. Open the published Internship Prep Desk and sign in. Choose a resume, remove identifiers from its preview, confirm review, and separately consent before requesting suggestions.
2. Use the dropdown and Add role; suggestions never activate themselves. Confirm availability/constraints and save the complete setup before Collect.
3. Keep the Site open during a collection so it can advance durable checkpoints; reload is safe. Allow about ten minutes, not a guaranteed deadline. Read source uncertainties and genuine gaps before acting.
4. Update only the chosen opportunity through its response control. Materials and interview preparation are separate explicit requests and consume their own allowances.
5. Reset creates and verifies a private recovery archive before clearing that student's active collection/materials. Retain up to five archives until explicitly deleted; download an older archive before deletion if needed. Reset retains setup and allowance history. Automatic archive restoration is not implemented.
6. For development use Node 22.13+, install committed dependencies, apply committed `drizzle/*.sql` migrations, then run `npm run dev`. `npm run build` builds the supported Sites Worker. Build/push the exact Sites source before saving/deploying a Sites version. Never publish `work/`, local runtime stores, credentials, resumes or output documents.

## Verification and limits

The six supplied PDF fixtures were tested with real OpenAI/Jev services through the production workflow adapters and isolated local SQLite/R2-compatible storage. Availability/geography/authorization choices were explicitly test fixtures, not inferred facts about the resume owners. This is not six deployed-Site or six real-account acceptance tests.

| Test area | Observed result |
| --- | --- |
| Role suggestions | All six returned 6–8 supported titles; exact cache reuse made no extra model call; no Collect use or automatic preference save. |
| Collect | Three to five distinct records per resume; 22 total. Initial matching took roughly three to four-and-a-half minutes. Source uncertainty was retained. |
| Jev | 19 current scores; three correctly withheld for insufficient evidence, not a provider outage. |
| Targeted update | All six completed zero-search scoped reassessment; replay rejected; unaffected records preserved. Genuine gaps remained unresolved when no new qualification evidence was supplied. |
| Word downloads | Six resumes, six cover letters and six interview files saved/downloaded. Rendered with installed LibreOffice and inspected for heading separation, readable layout, original-text preservation, selective highlights, separated review notes and posting-specific practice themes. One resume had zero safe edits and was explicitly labeled a preserved copy, not a tailored result. |
| Interview | Two distinct searches per fixture. No exact accessible candidate report was accepted in this batch; position-specific likely questions/general process guidance remained clearly labeled alternatives. |
| Reset/restart | All six archives verified; active collection/drafts cleared, setup/original and quotas retained. An additional post-reset Collect saved three new opportunities with three Jev scores. |
| Regression suite | 125 offline tests pass; TypeScript check and Worker build pass. Tests include malformed/empty/provider-failure responses, consent, origin/auth, account/cache isolation, five-request and shared limits, deletion, document guards, and removal of obsolete discovery-stage sentences while preserving real source/fit issues. |

The deployed owner-browser check verified role suggestions, explicit Add/remove, free cache reuse, saved setup, and a real Collect that added four records with three scores in 3m 29s. The owner test collection was then archived/reset, its ZIP downloaded and integrity-checked, and a fresh Collect added three records with three scores in 2m 35s. Obsolete discovery-stage sentences are also suppressed when presenting older successfully saved runs; actual write/source failures remain visible. Anonymous access to the role API was denied (401), and the development-only preview was absent (404). Detailed production browser/deployment evidence is recorded separately in the private build record. Offline account-isolation tests do not establish that a second real student's sign-in has been exercised on the live Site.

## Engineer review items

- Run a classroom canary with a second real signed-in account: verify profile, collection, cache, download and reset separation. The owner-session walkthrough cannot replace this check.
- Model output remains variable. Keep thin evidence, rejected edits, source-access failures, empty results and unknown eligibility visible; do not manufacture a score or a tailoring change to fill a target.
- PDF-to-Word layout is reconstructed, not pixel-identical to the original PDF. Students must review contacts, formatting and every proposed edit. Keep the original private upload unchanged.
- Provider-side spend alerts/hard limits remain the owner's responsibility; application start limits are not a monetary guarantee.
- Maintainer: Site owner. Future data/schema releases must recheck authentication, owner scope, cache deletion and exact-source contracts; dependency upgrades require renewed PDF/Word/browser checks.

## Maintenance references

Use the repository's tool/Skill/policy specifications, bundled task-scoped copies in `lib/hosted/specs/`, committed migrations, dependency manifests and `test/` regression files. Private evidence under the maintainer's ignored `work/role-suggestions-qa/` is deliberately excluded from Git and deployment archives.
