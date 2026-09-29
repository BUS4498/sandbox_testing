# Local Daily Schedule Specification

This specification applies only to the locally running application. The owner-only Codex Site currently has manual collection only; its cloud Daily Run was removed and remains deferred under [`codex-sites-private-pilot.md`](codex-sites-private-pilot.md).

## Purpose

The optional daily trigger is owned by the local controller. It invokes the same bounded collection workflow as **Collect Opportunities** at the student's configured local time. Scheduling grants no additional authority.

## Architecture

```text
Local Daily Trigger
        ↓
Shared Collection Entry Point
        ↓
RETRIEVE → SENSE → REASON → DECIDE → ACT → VERIFY → REMEMBER
```

## Student Controls

The dashboard should allow the student to:

- enable or disable daily collection;
- select one local run time;
- see the current local timezone;
- see the last scheduled attempt and actual result;
- see the next expected run while the local application remains available; and
- identify a missed, delayed, active, successful, partial, or failed run.

Configuration is stored under Git-ignored local runtime data and must not contain the API key or unnecessary student information.

## Scheduled Workflow

A scheduled run must use the same controller entry point, specifications, context, policies, duplicate-prevention logic, budgets, actions, verification, and memory as manual collection. Its trigger is recorded as `SCHEDULED`; manual collection is recorded as `COLLECT_NOW`.

Before starting, the controller must verify that a complete real-student setup or an explicitly selected synthetic demonstration setup is active. If setup is incomplete, the scheduled attempt is skipped before any API request, recorded as **Needs Student Setup**, and surfaced with the exact missing fields and a next action. It must not silently use synthetic defaults or claim that collection occurred.

The objective is to process the top three to five sufficiently relevant new or materially changed opportunities when at least three qualify, within the hard maximums of six searches, fifteen candidates, and five selected updates. Fewer than three are allowed with a visible shortfall reason.

## Local Availability and Missed Runs

The initial scheduler runs only while the local application process is active. The interface must say this plainly. If the application was not running at the configured time, it must not invent a completed run. On the next startup, the controller should compare the saved schedule with the last observed process/run state and show **Missed Run** when supported by evidence.

The initial implementation does not create Windows Task Scheduler jobs, macOS launch agents, or cloud jobs. Those may be added later only through a separate, explicit installation and permission design.

## Concurrency and Recovery

- Never start a scheduled collection while another workflow is active.
- Record a deferred scheduled attempt and next safe action rather than interrupting a targeted update.
- Do not automatically repeat an external action whose prior outcome is uncertain.
- A failed or partial run must preserve completed verified work, unresolved issues, and the next action.
- Unresolved issues do not keep the process running indefinitely.

## Security and Approval Boundary

Scheduling does not preapprove applications, employer communications, final-material changes, or new external disclosures. The scheduled run uses the same student authority rules as manual collection. API keys and other credentials must never appear in schedule settings, prompts, dashboard events, or logs.

