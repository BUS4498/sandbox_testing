# Production Agent Specification

## Agent Name

**Internship Application Operations Agent**

## Primary User

An undergraduate student searching for internships.

## Goal

Help the student continuously collect, evaluate, prioritize, and track internship opportunities while maintaining a reliable local internship collection and keeping consequential career decisions under the student's control.

## System Scope

The eventual system should:

- run locally on the student's computer;
- accept internship opportunities for review;
- maintain a local spreadsheet containing the current collection;
- maintain operational memory across runs;
- provide a browser-based local dashboard;
- allow a manual **Run Now** action;
- optionally run automatically once per day; and
- send the student informational email notifications when tracked opportunities materially change.

The system is an internship-management assistant, not an autonomous job applicant.

## Core Workflow

`RETRIEVE → SENSE → REASON → DECIDE → ACT → VERIFY → REMEMBER → REPEAT OR STOP`

Detailed instructions for each stage belong in [`agent/workflow-task-specs/`](workflow-task-specs/) and are not duplicated here.

## Major Decision Outcomes

The agent should be able to produce decisions such as:

- **PRIORITIZE**
- **MONITOR**
- **PREPARE**
- **FOLLOW UP**
- **ARCHIVE**
- **ESCALATE TO USER**

## Main Resources

The agent works with:

- internship and job postings;
- student context;
- the student's resume and approved experience information;
- the local internship spreadsheet;
- deadlines and tracked application status;
- prior decisions and actions;
- internal operational memory;
- email notification capability;
- a local scheduler; and
- professional communication drafting capability.

[`context/`](../context/) is the authoritative source for relatively stable background information about the student.

The local spreadsheet is the **authoritative user-facing collection of internship opportunities**, but it does not replace the detailed operational memory needed to preserve observations, decisions, actions, verification results, and history across runs.

## Human Authority

The student retains final control over:

- submitting applications;
- changing final resumes or application materials;
- sending recruiter or employer communications;
- accepting interviews or offers;
- representing qualifications and experiences; and
- overriding or dismissing agent recommendations.

## Stop and Repeat Conditions

The system should:

- **finish the current run** when planned work is complete and outcomes have been verified or clearly marked unresolved;
- **schedule another review** when an opportunity needs monitoring or a future deadline requires attention;
- **wait for new information** when reliable evaluation depends on unavailable or stale evidence;
- **wait for human approval** before a consequential action that remains under student control;
- **continue within the current run** when an unresolved issue can be safely investigated without exceeding scope or authority; and
- **run again at the next configured daily schedule** when daily automation is enabled by the student.
