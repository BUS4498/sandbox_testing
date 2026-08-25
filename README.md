# Internship Application Operations Agent

> **Current status:** This repository contains **system-design specifications only**. The working application will be added in a later phase.

## What this project is

The Internship Application Operations Agent is a planned local-first assistant for an undergraduate student searching for internships. The eventual system will help collect, evaluate, prioritize, and track opportunities while keeping consequential career decisions under the student's control.

The future application will run on the student's computer and provide a local browser-based dashboard. A local spreadsheet will serve as the student's user-facing collection of current internship opportunities. After a material collection update succeeds, informational email notifications will tell the student what changed and what may need attention.

The system is designed to support both:

- a student-initiated **Run Now** action; and
- an optional once-per-day scheduled run.

No working agent, frontend, spreadsheet, email integration, scheduler, or production runtime is included yet.

## Production workflow

`RETRIEVE → SENSE → REASON → DECIDE → ACT → VERIFY → REMEMBER → REPEAT OR STOP`

Detailed responsibilities for each stage are defined in the workflow task specifications.

## Core concepts

- **Context:** relatively stable background information supplied to the agent.
- **Memory:** dynamic operational information accumulated through agent activity.
- **Spreadsheet:** the user's visible collection of current internship opportunities.
- **Frontend:** the human interaction layer.
- **Tools:** capabilities that allow the production agent to access information or perform actions.

## Specification navigation

- [Production agent overview](agent/agent.md)
- [Workflow task specifications](agent/workflow-task-specs/)
- [Tool specifications](agent/tools/)
- [Policies and rules](agent/policy-and-rules/)
- [Memory specifications](agent/memory/)
- [Synthetic student context](context/)
- [Job-fit-assessment production Skill](agent/skills/job-fit-assessment/SKILL.md)
- [Local frontend design](frontend/frontend-design.md)
- [Runtime-data guidance](data/README.md)

## Implementation boundary

The next phase may use these specifications to build the local application. Implementation must preserve the defined approval boundaries: the agent is an internship-management assistant, not an autonomous job applicant.
