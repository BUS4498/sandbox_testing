# State Memory Specification

## What is stored

State memory stores the latest known operational state for each opportunity and for the local agent, including:

- stable opportunity identifier;
- current opportunity and application status;
- deadline;
- current recommendation;
- next action and next-action date;
- next review time;
- outstanding tasks and unresolved issues;
- current daily schedule status, last run, and next scheduled run;
- last verified time; and
- links to the observations, decisions, actions, and evaluations supporting the state.

Each state record should have a version and distinguish known, unknown, conflicting, and not-applicable values.

## Why it is needed

State memory lets a later cycle resume from the current operational position without reconstructing it from raw conversation or scanning all history. It complements the user-facing spreadsheet with internal links and control state.

## When it is written

Write state memory after a new opportunity is accepted, a material field changes, an action or verification changes current status, the student supplies an authoritative update, or schedule/task state changes. Use version-aware updates and preserve links to the prior state.

## When it is retrieved

Retrieve only the relevant opportunity state at the start of a review, when checking duplicates, before deciding or acting, and when showing current run or schedule status.

## How it influences future cycles

State memory determines what needs attention, which deadline or task is current, whether the opportunity has already been processed, and when it should be reviewed again. It does not by itself prove why a state is correct; later stages should follow its evidence links.
