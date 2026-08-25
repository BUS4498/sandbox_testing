# SENSE Task Specification

## Purpose

Gather and structure new or current information about internship opportunities without making the final recommendation.

## When this task runs

Run after **RETRIEVE** for a newly supplied internship input, a scheduled or requested recheck, or a tracked opportunity that requires attention.

## Inputs

- Scoped retrieval package.
- A pasted job-posting URL, pasted posting text, or another approved internship input source.
- Relevant prior opportunity state and source history.

## Instructions

1. Read the approved input or recheck the relevant tracked posting.
2. Extract observable information such as organization, role, location, work mode, requirements, preferred qualifications, eligibility, deadline, posting status, and application status when available.
3. Preserve source, observation time, and the distinction between stated information, derived structure, and unknown values.
4. Compare the observation with the relevant tracked record.
5. Classify it as:
   - `NEW OPPORTUNITY`;
   - `EXISTING — UNCHANGED`;
   - `EXISTING — MATERIALLY CHANGED`; or
   - `INVALID OR INCOMPLETE INPUT`.
6. Identify changes such as a revised deadline, closed posting, changed requirements, current status, or a newly due action.
7. Do not make the final decision or infer missing qualifications.

## Expected output

A structured opportunity observation, comparison with prior state, classification, material change set, source evidence, observation time, and unresolved information.

## Failure and exception handling

If content is inaccessible, incomplete, ambiguous, or contradictory, preserve what was actually observed and label the limitation. Do not treat a failed recheck as evidence that a posting closed.

## What is passed to the next stage

Pass the structured observation, change classification, prior tracked state, provenance, and unresolved fields to **REASON**.

## What should be remembered

Remember new observations, material changes, source status, and meaningful recheck failures. Avoid storing duplicate unchanged observations unless needed to document freshness.
