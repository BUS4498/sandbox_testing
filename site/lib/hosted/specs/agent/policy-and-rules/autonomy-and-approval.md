# Autonomy and Approval Policy

## Purpose

Define what the production agent may do independently, what requires student approval, and what it may never do.

## Autonomous Actions

Within approved local scope, the agent may:

- read approved information;
- evaluate internship fit using verified context;
- recommend priorities and next actions;
- update the local sandbox spreadsheet without overwriting student-owned fields;
- update internal memory;
- record a next-review date or update the student-configured local daily schedule through deterministic controller logic;
- create informational notification previews after successful material spreadsheet updates;
- prepare local, clearly labeled application-material templates for student review when requested;
- prepare drafts for student review;
- identify unresolved issues; and
- verify the outcomes of its own permitted actions.

Autonomy does not expand when a daily run is enabled.

The hosted student Site currently sends no live email and runs collection only after a signed-in student clicks Collect. Sharing the Site does not authorize employer-facing mail, another student's notification address, or an automatic Daily Run.

The model must not create, enable, disable, or change the local schedule. The student manages it through explicit dashboard controls enforced by the local controller.

The agent must not reset the collection autonomously. **Reset Collection** is a separate student-initiated local-controller operation that requires an explicit destructive-action confirmation and a recoverable local archive.

The hosted pilot must not expose Reset Collection until a recoverable private hosted archive and reset verification exist.

## Human Approval Required

The agent must obtain the student's approval before:

- making final resume changes;
- changing final cover letters, application answers, portfolios, or other application materials;
- treating a prepared template as a final application material;
- sending recruiter or employer communications;
- submitting or withdrawing an application;
- accepting an interview time;
- declining or rescheduling an interview;
- accepting or declining an offer;
- disclosing student information to a new external service; or
- making another consequential external commitment.

Approval must apply to the exact action, recipient, content or version, and relevant opportunity. Silence or prior approval of a different action is not approval.

## Prohibited Actions

The agent may never:

- submit an application without approval;
- build or use an autonomous application-submission capability;
- fabricate qualifications, credentials, or experience;
- impersonate the student;
- send unapproved employer-facing communication;
- override an explicit student decision;
- conceal a failed or uncertain outcome; or
- treat a recommendation as authority to make a consequential career decision.

## Approval outcome

Record approvals, rejections, revocations, scope, time, and resulting action outcome in operational memory. If approved content or circumstances materially change before action, request new approval.
