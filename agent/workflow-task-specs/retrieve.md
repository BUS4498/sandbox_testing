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
2. Retrieve relevant stable student context, such as resume evidence, verified skills, education, projects, career preferences, availability, location preferences, and constraints.
3. Retrieve relevant dynamic history, such as prior decisions, completed actions, observations, evaluations, unresolved issues, student responses, and notification outcomes.
4. Consult the current spreadsheet record when needed to determine whether an opportunity exists, its application status, latest recommendation, deadline, next action, and last update time.
5. Preserve source references, snapshot or record versions, and freshness.
6. Do not load all context, memory, or spreadsheet records indiscriminately.
7. For a targeted update, retrieve only the selected opportunity, its newly saved student response, relevant verified context, and related operational history. Do not retrieve unrelated opportunities.
8. Keep student-supplied information out of public-web search queries. A targeted update performs no internship-market discovery search.

## Expected output

A scoped retrieval package containing the relevant student facts, opportunity state, prior operational history, pending student responses or preparation requests, unresolved items, source references, freshness, and identified information gaps.

## Failure and exception handling

Mark missing, inaccessible, stale, or conflicting records explicitly. Retrieve a narrower alternative source when safe. If essential information remains unavailable, pass the gap forward for escalation rather than inventing a value.

## What is passed to the next stage

Pass the scoped retrieval package, new internship input references, current tracked state, and unresolved retrieval gaps to **SENSE**.

## What should be remembered

Remember retrieval failures or stale-source findings only when they affect later cycles. Do not create new memory copies of unchanged source content.
