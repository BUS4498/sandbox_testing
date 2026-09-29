# Owner-only cloud Daily Run

The hosted pilot's Daily Run uses a GitHub Actions schedule as an external wake-up call. It is separate from the local app's in-process daily timer and works while the student's computer is off. The workflow file must be on the GitHub repository's default `main` branch. Target time: **9:00 AM America/Los_Angeles**. GitHub may delay or omit a scheduled job, so the dashboard reports actual runs and missed days instead of treating the calendar trigger as proof that work occurred.

## Trigger and authority

`GitHub Actions → authenticated private-Site trigger → hosted controller → existing Collect Opportunities workflow`

The GitHub job carries no student profile, opportunity data, OpenAI key, or application material. It uses two GitHub Actions secrets: a private Site access token that allows an identity-less request through the Site's sign-in gate, and a separate, revocable Daily Run trigger token. The Site stores only a hash of the latter. Neither secret belongs in repository files, logs, prompts, or browser storage. The Site accepts the trigger only for the owner who explicitly enabled Daily Run in the authenticated dashboard; disabling or rotating the token revokes future scheduled processing.

The trigger invokes the same bounded collection entry point as **Collect Opportunities**: at most six web searches, fifteen candidates, and five new or materially changed opportunities. The usual profile, policies, duplicate checks, approval rules, verified writes, and memory apply. Live email remains disabled until its separate authorization group is complete. A manual check-only GitHub invocation validates connectivity without a model call or collection write.

## One run per day and visible failures

Before a billable workflow starts, persist one owner-and-local-date attempt with the GitHub run identifier. Reject replayed identifiers and a second scheduled trigger for that date. A run lock prevents overlap with Collect, updates, material preparation, and reset. Record start, completion, failure, and linked collection run. Do not silently retry an ambiguous or failed run. If the Site is disabled, setup is incomplete, credentials are missing, a workflow is already active, or the trigger is early, show the actual skipped/failure state and the next action.

The dashboard shows **Enabled/Disabled**, the 9:00 AM Pacific target, last scheduled attempt and outcome, next expected day, and missed-run status. A missed day is a day when Daily Run was enabled and no completed scheduled attempt was recorded after the target time. Do not display an invented successful run. The owner can still use Collect Opportunities manually, but a manual run is labeled separately and does not rewrite scheduled-run history.

## Activation boundary

Do not call the GitHub workflow active merely because its file is committed or the Site can receive a trigger. Activation requires both secrets to be configured in GitHub Actions, a successful non-billable check-only invocation through the private Site, an explicitly enabled Site setting, and a verified first scheduled outcome. If any step is unavailable, show **Setup required** or **Not connected** and keep Daily Run disabled.
