# Codex Schedule Specification

## Purpose

Daily execution is a **Codex harness-level trigger**, not a tool used by the Internship Application Prep Agent. A Codex thread automation should return to the approved internship-agent thread once per day at the student's configured local time and invoke the same discovery workflow used by **Collect Opportunities**.

This file specifies the intended scheduling arrangement. It does not create an automation or implement a scheduler.

## Schedule Architecture

```text
Codex Thread Automation
        ↓
Daily at configured local time
        ↓
Return to approved internship-agent thread
        ↓
Run approved workflow
```

Codex owns the automation schedule and thread wake-up. The internship agent owns the business workflow that begins after the trigger. Scheduling does not become an agent tool and grants no additional authority.

## Schedule Ownership

For this prototype:

- the student creates, enables, pauses, changes, or removes the daily automation in Codex;
- Codex associates the automation with the approved internship-agent thread;
- Codex returns to that thread on the configured cadence rather than creating a separate workflow;
- the local controller may display schedule and run information made available by Codex, but it does not implement its own scheduling engine; and
- the dashboard should direct the student to Codex when the schedule must be managed.

The automation may reuse the thread's accumulated conversation context, but the thread is not a substitute for the repository's structured operational memory. The spreadsheet and operational memory remain the authoritative sources for current collection state, duplicate prevention, action history, verification, and unresolved issues.

## Daily Run Instruction

The automation instruction should remain concise:

> Run the Internship Application Prep Agent.
>
> Follow `agent/agent.md` and relevant specifications.
>
> For this run:
> - use no more than 3 targeted searches;
> - use the approved prioritized source portfolio in `agent/tools/internship-web-search.md`;
> - collect no more than 15 candidates;
> - select the top 3–5 relevant new or materially changed opportunities when at least 3 qualify;
> - update the spreadsheet;
> - send permitted notifications;
> - verify outcomes;
> - update memory;
> - stop.

The instruction invokes the approved repository specifications; it does not restate every workflow stage, tool contract, or policy in a permanent scheduling prompt.

## Scheduled Run Behavior

After the automation triggers the thread, the agent should:

1. retrieve current student preferences and relevant operational state;
2. use the bounded general public web-discovery process and prioritized source portfolio defined in `agent/tools/internship-web-search.md` and `agent/workflow-task-specs/sense.md`;
3. collect no more than 15 plausible candidates across no more than three targeted searches;
4. remove obvious invalid, closed, unchanged, or duplicate opportunities before expensive reasoning;
5. rank the remaining new or materially changed candidates;
6. select the top three to five sufficiently relevant opportunities when at least three qualify, or record a selection shortfall reason;
7. complete the normal `RETRIEVE → SENSE → REASON → DECIDE → ACT → VERIFY → REMEMBER → REPEAT OR STOP` workflow for the selected opportunities;
8. perform only permitted spreadsheet and notification actions;
9. verify attempted actions and record their actual outcomes;
10. update the relevant operational memory and run summary; and
11. end the run after unresolved issues have been assigned an appropriate next action, later review, or escalation.

Five remains a hard maximum. Three is the normal minimum when at least three candidates qualify. A run may process fewer than three only when fewer qualify or a documented external failure prevents a complete bounded search; it must record the shortfall rather than search indefinitely, admit weak candidates, or reprocess unchanged opportunities merely to fill positions.

## Same Discovery Workflow as Collect Opportunities

**Collect Opportunities** and the daily Codex automation must invoke the same production-discovery entry point and use the same:

- workflow stages;
- policies and approval boundaries;
- verified student context;
- operational memory;
- bounded-discovery limits;
- duplicate-prevention rules;
- decision process;
- action rules; and
- verification and completion requirements.

The trigger source should be recorded as `MANUAL` or `SCHEDULED` for audit and dashboard reporting. It must not change the agent's authority.

## Required Configuration

- Approved internship-agent thread identifier.
- Repository workspace location.
- Enabled or paused automation state.
- Daily run time and current local timezone.
- Concise daily run instruction.
- Last attempted run and its actual result.
- Next expected scheduled run when available.

Schedule configuration must not contain credentials or unnecessary student information.

## Missed, Delayed, or Failed Runs

The application must not claim that a scheduled run occurred unless Codex actually started it. If the computer, Codex application, required local runtime, or repository workspace was unavailable at the scheduled time, the next available interface should surface the run as missed or unavailable rather than creating a retroactive success record.

A failed or interrupted run should preserve its actual status, verified completed actions, unresolved issues, and appropriate next action. It should not automatically repeat consequential actions whose prior outcome is uncertain.

The dashboard should show the best schedule information available from Codex, including configured status, last run, next run, and attention-required state. When Codex does not expose a reliable value, the dashboard should display it as unknown rather than infer it.

## Approval and Security Boundary

A scheduled trigger does not preapprove actions. The automation must follow `agent/policy-and-rules/autonomy-and-approval.md`, and any approval required during an unattended run must remain pending for the student or cause an appropriate safe stop.

Schedule management and execution records should remain local. The controller must not place secrets in automation instructions, command arguments, dashboard events, or logs. Any external disclosure must follow the minimum non-identifying disclosure principle and the repository's privacy rules.

## Explicit Non-Goal

Do not build a second scheduler inside the dashboard or local controller for this prototype. Codex owns the daily automation; the local application displays its state and invokes the same discovery workflow manually through **Collect Opportunities**. Targeted **Update Opportunity** actions remain student-initiated and are not delayed until the daily collection.
