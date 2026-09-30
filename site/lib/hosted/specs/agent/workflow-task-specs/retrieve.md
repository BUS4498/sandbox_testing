# RETRIEVE Task Specification

## Purpose

Load only the student context, prior operational state, and tracked-opportunity information needed for the current run or opportunity.

## When this task runs

Run first in every manual collection, scheduled collection, or targeted opportunity-update cycle. Run again only if a later stage identifies a specific missing record needed to continue.

## Inputs

- Run trigger, run ID, and current opportunity or run scope.
- References to `context/`, operational memory, and the local internship spreadsheet.
- New internship input supplied through the eventual frontend, when present.
- A specific unresolved issue, review target, or scheduled follow-up.

## Instructions

1. Determine the minimum information needed for this cycle.
2. Verify that one complete student-setup mode is explicitly active before collection or assessment:
   - **Real student setup:** a confirmed non-identifying private resume profile plus confirmed local preferred roles, availability, location and work-arrangement boundaries, and relevant constraints; or
   - **Synthetic demonstration setup:** the student has explicitly selected the labeled synthetic package in `context/`.
3. Determine the active source for each context category. Retrieve only the relevant resume evidence, verified skills, education, projects, career preferences, availability, location preferences, and constraints. Never silently mix missing real-student fields with synthetic defaults.
4. Retrieve relevant dynamic history, such as prior decisions, completed actions, observations, evaluations, unresolved issues, student responses, and notification outcomes.
5. Consult the current spreadsheet record when needed to determine whether an opportunity exists, its application status, latest recommendation, deadline, next action, and last update time.
6. Preserve source type, source references, snapshot or record versions, confirmation state, and freshness. Never treat an uploaded-but-unconfirmed resume or unsaved setup form as authoritative.
7. Do not load all context, memory, or spreadsheet records indiscriminately.
8. For a targeted update, retrieve only the selected opportunity, its newly saved student response, relevant verified context, and related operational history. Do not retrieve unrelated opportunities.
9. Keep student-supplied information out of public-web search queries except for the minimum non-identifying search criteria needed to find relevant postings, such as role themes, internship period, broad location boundaries, and work-arrangement preferences. Never include resume text, legal-eligibility details, or free-form private constraints in a web-search query. A targeted update performs no internship-market discovery search.

## Expected output

A scoped retrieval package containing the relevant student facts, opportunity state, prior operational history, pending student responses or preparation requests, unresolved items, source references, freshness, and identified information gaps.

## Failure and exception handling

Mark missing, inaccessible, stale, or conflicting records explicitly. If the student setup is incomplete, stop before web discovery or assessment, return the exact missing setup fields, and request student action. Do not make a model request or silently activate demonstration context. Retrieve a narrower alternative source when safe. If other essential information remains unavailable, pass the gap forward for escalation rather than inventing a value.

## What is passed to the next stage

Pass the scoped retrieval package, new internship input references, current tracked state, and unresolved retrieval gaps to **SENSE**.

## What should be remembered

Remember retrieval failures or stale-source findings only when they affect later cycles. Do not create new memory copies of unchanged source content.
