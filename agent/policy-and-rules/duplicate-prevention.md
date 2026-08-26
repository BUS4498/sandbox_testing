# Duplicate Prevention Policy

## Purpose

Prevent duplicate opportunity rows, unnecessary repeated reasoning, incorrect new-opportunity classifications, and repeated notifications for the same event, including when one opportunity is rediscovered through web search or appears on multiple public sources.

## Opportunity identity

Before treating a student-supplied or web-discovered opportunity as new, compare the strongest available identifiers, including:

1. canonical or original posting URL;
2. normalized company;
3. normalized role title;
4. normalized location when relevant;
5. internship period;
6. an existing opportunity ID or employer posting ID; and
7. prior discovery memory and source history.

Normalize redirects and remove non-identifying tracking parameters when deriving a canonical URL, while preserving the original observed URL as provenance. A new source URL, search-result URL, or secondary listing does not by itself establish a new opportunity when it refers to the same employer opening.

Company or role similarity alone may be insufficient when an employer has multiple openings. Conversely, minor differences in company naming, title punctuation, capitalization, location formatting, or source wording do not by themselves establish a distinct opportunity.

## Pre-reasoning duplicate gate

Whenever practical, perform duplicate checking during **SENSE** before detailed AI reasoning or job-fit assessment. Use deterministic normalization and comparison first, including the available:

- canonical or original posting URL;
- company;
- role title;
- location when relevant;
- internship period;
- opportunity ID or employer posting ID; and
- prior discovery memory and source history.

An obvious match to an unchanged known opportunity should leave the discovery funnel before **REASON**. Limited identity resolution may be used when the evidence conflicts or a composite match is uncertain, but the system should not perform a full fit assessment merely to determine whether a posting is already known.

Detailed reasoning may be repeated for a known opportunity only when there is a documented reason, such as a material posting change, new verified student context, a due review condition, a student request, or correction of an earlier incomplete or failed evaluation.

## Before adding an opportunity

The agent must check the current spreadsheet and relevant discovery, observation, and action memory for a matching opportunity ID, canonical or original posting URL, or strong composite match. It must not:

- create duplicate spreadsheet rows for the same opportunity;
- treat an unchanged opportunity as a new one;
- repeatedly perform detailed reasoning on an unchanged known opportunity without a documented reason;
- send repeated "new opportunity" emails for an already-recorded opportunity; or
- repeatedly classify the same unchanged posting as newly discovered in later manual or scheduled searches.

When the same opportunity appears on an employer career page and a secondary source, retain the strongest available source and preserve the other source as provenance rather than creating another row. A posting's absence from later search results is not sufficient evidence that it closed.

When identity is uncertain, flag a possible duplicate and ask the student rather than merge or add automatically.

## Material changes

If an existing opportunity materially changes, the agent should:

1. retain its existing opportunity identity rather than classify it as new;
2. update the existing record;
3. identify the fields and information that changed;
4. record the change and preserve the prior value in operational history;
5. process it as a material update under the normal workflow;
6. verify the spreadsheet update; and
7. create one corresponding update notification to the student only when the change is material.

Potentially material changes include:

- an application deadline changed;
- the posting closed or its status otherwise materially changed;
- role responsibilities, requirements, or qualifications changed;
- the location or work arrangement changed;
- the internship period changed;
- the agent recommendation changed because of new verified evidence;
- the application status materially changed; or
- a materially different follow-up action became due.

Formatting-only differences, tracking-parameter changes, reordered content, insignificant wording changes, and repeated unchanged observations are not material and must not create a new opportunity or material-update notification.

## Notification idempotency

Assign each notification an idempotency key based on the stable opportunity ID, material change type, resulting record version, and normalized changed values. A successful or pending notification with the same key must not be sent again. A retry after failure must reuse the key and preserve the prior attempt history.

## Manual correction

Student-approved merges or splits must be reversible, retain provenance, and never overwrite explicit student-owned status or notes.
