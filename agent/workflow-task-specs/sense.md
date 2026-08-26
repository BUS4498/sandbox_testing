# SENSE Task Specification

## Purpose

Gather and structure new or current information about internship opportunities from student-supplied inputs or agent-discovered public web sources without making the final recommendation.

## When this task runs

Run after **RETRIEVE** for a newly supplied internship input, a manual **Collect Opportunities** cycle, a scheduled daily collection cycle, a requested source recheck, or a targeted **Update Opportunity** cycle.

## Inputs

- Scoped retrieval package containing only the student context relevant to the current input or search.
- Input mode: `USER-SUPPLIED`, `AGENT-DISCOVERED`, or `STUDENT-UPDATE`.
- For a user-supplied opportunity: a job-posting URL, pasted posting text, or another approved input.
- For agent discovery: an approved manual or scheduled run trigger and access to the [`internship-web-search`](../tools/internship-web-search.md) tool.
- Relevant prior opportunity state, identifiers, discovery observations, and source history.

## Mode A — User-Supplied Opportunity

The student may provide:

- a job-posting URL;
- pasted job-posting text; or
- another approved input.

For this mode:

1. Read the approved input or inspect the underlying posting when reasonably accessible.
2. Structure the observable opportunity information.
3. Preserve source, observation time, and the distinction between stated information, derived structure, and unknown values.
4. Compare the observation with the relevant tracked record and prior source history.

## Mode B — Agent-Discovered Opportunity

A manual **Collect Opportunities** action or enabled scheduled daily collection may invoke the [`internship-web-search`](../tools/internship-web-search.md) tool.

Automatic discovery follows this bounded funnel:

`SEARCH → COLLECT → VALIDATE → DEDUPLICATE → FILTER → RANK → TOP 3–5`

The funnel should reduce the candidate pool before expensive model reasoning. It must not perform a separate detailed fit assessment for every search result.

### Step 1 — Search

1. Use the relevant verified student search preferences supplied by **RETRIEVE**. If essential preferences are missing, request a scoped retrieval rather than infer them.
2. Invoke the [`internship-web-search`](../tools/internship-web-search.md) tool.
3. Select source-focused searches from the approved priority portfolio in the tool specification, using the highest-priority sources relevant to the current student context and recent source coverage.
4. Perform no more than three targeted general public web searches. The three-query budget does not require searching every approved source in one run.

### Step 2 — Collect candidate pool

1. Collect no more than 15 plausible internship opportunities for screening.
2. Preserve each candidate's source reference and the information needed for validation and comparison.
3. Do not require detailed job-fit reasoning at this point.

### Step 3 — Validate

Check whether each candidate appears to be:

- a real internship opportunity;
- currently accessible;
- reasonably current; and
- supported by a valid source.

Inspect the underlying posting when reasonably accessible. Prefer an employer-controlled Greenhouse, Lever, or Ashby posting for final verification when an approved secondary source identifies the opportunity and such a posting is reasonably available. Do not accept a search-result snippet alone as sufficient evidence when the posting can be checked. Preserve unavailable or uncertain fields rather than inventing them.

Assign a validation or posting status when supported:

- `ACTIVE`;
- `CLOSED`;
- `UNCERTAIN`; or
- `INVALID / INCOMPLETE`.

Validation or posting status is separate from the duplicate and change classification below. For example, a tracked posting may be both `CLOSED` and `EXISTING — MATERIALLY CHANGED`.

### Step 4 — Deduplicate

Before expensive reasoning, compare each candidate against:

- existing spreadsheet records;
- canonical or original posting URL;
- company;
- role title;
- location when relevant;
- existing opportunity ID when available; and
- prior discovery memory.

Apply the approved duplicate-prevention rules. Consolidate obvious duplicate sources for the same opportunity and do not treat an unchanged known opportunity as new.

Classify the candidate's relationship to the tracked collection as:

- `NEW`;
- `EXISTING — UNCHANGED`;
- `EXISTING — MATERIALLY CHANGED`; or
- `DUPLICATE CANDIDATE` when multiple current candidate records represent the same opportunity and must be consolidated before comparison.

### Step 5 — Apply cheap deterministic filters

When supported by clear evidence, exclude a candidate from relevance ranking before detailed model reasoning if it:

- is not actually an internship;
- is for the wrong internship period;
- clearly conflicts with a hard geographic or availability constraint;
- is a closed posting that is not a newly detected material change to a tracked opportunity;
- is an existing unchanged opportunity;
- is a known duplicate after consolidation; or
- is invalid or too incomplete to support further processing.

Do not spend unnecessary model calls on candidates that deterministic checks can eliminate. Record the applicable filter reason. Do not use a deterministic filter when the necessary fact or constraint is uncertain.

A newly observed closure or other operationally significant change to a tracked opportunity remains eligible for selection as a material update even when it does not require a new fit assessment.

### Step 6 — Rank remaining candidates

Rank the remaining new or materially changed candidates by relevance to the student's verified profile, preferences, constraints, and current application operations. When practical, evaluate multiple candidates together rather than making a separate model call for every candidate.

Ranking should consider:

- required qualification alignment;
- preferred qualification alignment;
- Information Systems and business relevance;
- student career preferences;
- location and work-arrangement fit;
- internship timing;
- deadline urgency;
- meaningful qualification gaps; and
- quality and reliability of the posting evidence.

Use structured evidence and an explained comparison. Do not rely solely on one unexplained numerical score. This is a screening-level ranking; detailed job-fit assessment remains the responsibility of **REASON** for selected opportunities.

### Step 7 — Select top opportunities

On a normal successful discovery run, select the three to five strongest sufficiently supported `NEW` or `EXISTING — MATERIALLY CHANGED` opportunities when at least three qualify. Consider both student fit and operational importance, such as a consequential deadline or posting-status change.

Only selected opportunities proceed to the detailed workflow:

`REASON → DECIDE → ACT → VERIFY → REMEMBER`

If fewer than three opportunities meet the relevance, validity, hard-constraint, and evidence requirements, process the smaller number and return a concise `selection shortfall reason`. A documented search or source failure may also justify fewer than three. Do not add weak, invalid, closed, or duplicate opportunities merely to reach three.

Agent discovery must not imply that search results are exhaustive or bypass login requirements, access controls, or other source restrictions. LinkedIn, Indeed, and Wellfound may be used only to the extent that the relevant listing is publicly accessible without authentication.

## Mode C — Student Update to a Tracked Opportunity

A targeted **Update Opportunity** action processes one newly saved student response for one existing opportunity. It must:

1. validate that the opportunity and response still exist;
2. structure the new confirmation, clarification, not-interested decision, or application-material request;
3. compare the new information with the current spreadsheet record and operational memory;
4. identify which prior gap, next action, decision, or preparation request the response may resolve; and
5. pass that single scoped update forward for immediate reasoning and decision.

This mode performs no internship-market web search, candidate collection, ranking funnel, or top-three-to-five selection. It must not wait for the next **Collect Opportunities** action or daily collection run.

## Instructions for both modes

1. Extract observable information such as organization, role, location, work arrangement, internship period, responsibilities, required qualifications, preferred qualifications, eligibility, application deadline, source, posting URL, posting status, date discovered, and date last verified when available.
2. Preserve provenance, observation time, source reliability, uncertainty, and the distinction between observed information and derived structure.
3. Compare each observation with the relevant tracked record, stable opportunity identifiers, and prior discovery history.
4. Keep posting or validation status separate from the result's relationship to the existing collection. Do not force `ACTIVE`, `CLOSED`, `UNCERTAIN`, or `INVALID / INCOMPLETE` into the same field as `NEW`, `EXISTING — UNCHANGED`, or `EXISTING — MATERIALLY CHANGED`.
5. Identify material changes such as a revised deadline, posting closure, changed requirements, changed location or work arrangement, or new reliable evidence.
6. Do not infer missing qualifications or unavailable posting facts.
7. Do not make a final `PRIORITIZE`, `MONITOR`, `PREPARE`, `FOLLOW UP`, `ARCHIVE`, or `ESCALATE TO USER` decision. Final detailed fit assessment and prioritization belong to **REASON** and **DECIDE**.

## Expected output

For every processed result, return a structured opportunity observation or student update, input mode, validation status, comparison with prior state, material change set, source evidence, observation time, and unresolved information.

For an agent-discovery cycle, also return:

- searches performed, up to three;
- candidates collected, up to 15;
- candidates validated;
- duplicates consolidated or removed;
- candidates removed by each deterministic filter;
- candidates ranked;
- opportunities selected for detailed processing, up to five;
- selection shortfall reason when fewer than three are selected;
- unchanged results ignored;
- stop condition; and
- results requiring attention.

Counts should make movement through the funnel auditable without storing unnecessary full web pages or private reasoning.

For a targeted student update, return the response identifier, selected opportunity identifier, the prior gap or action addressed, facts supplied by the student, any remaining uncertainty, and confirmation that discovery-search counts are zero.

## Failure and exception handling

If content is inaccessible, incomplete, ambiguous, or contradictory, preserve what was actually observed and classify or label the limitation appropriately. Do not treat a failed search, inaccessible page, missing result, or failed recheck as evidence that a posting closed.

An `UNCERTAIN` or `INVALID / INCOMPLETE` result must not be silently converted into a valid new opportunity. Preserve any source-verification issue for later review or escalation. A failed query does not expand the three-query budget or justify lowering validation and relevance standards.

## What is passed to the next stage

For agent discovery, pass the selected top three to five `NEW` and `EXISTING — MATERIALLY CHANGED` opportunities to **REASON** when at least three qualify. Pass a smaller supported set only with the required selection shortfall reason. Include their structured observations, prior tracked state, provenance, ranking evidence, and unresolved fields. Include a `CLOSED` posting only when it represents a selected material status change to a tracked opportunity. Do not send an unchanged result, filtered candidate, invalid candidate, or duplicate through detailed fit reasoning solely because it appeared in search.

For a user-supplied opportunity, pass a supported `NEW` or `EXISTING — MATERIALLY CHANGED` result forward according to the normal single-opportunity path; the automatic-discovery candidate limits do not prevent the student from asking the agent to review a specific posting.

For a targeted student update, pass exactly one existing opportunity, its scoped student response, current decision evidence, and remaining gaps to **REASON**. Do not invoke or report the discovery funnel.

## What should be remembered

Remember new discoveries, verified postings, material changes, source status, closures, source-verification issues, and meaningful search or recheck failures. Avoid storing duplicate unchanged observations unless the verification timestamp is needed to document freshness. Do not store unnecessary full web pages when structured evidence and source references are sufficient.
