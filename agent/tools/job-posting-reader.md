# Job Posting Reader Tool Specification

## Tool name

**Job Posting Reader**

## Purpose

Read and structure an internship or job posting while preserving its source, uncertainty, and missing information. This document specifies a future capability; it does not implement a reader.

## When the agent may use it

The agent may use this tool during **SENSE** for a new opportunity or an approved recheck of a tracked opportunity. Input may be a job-posting URL, pasted posting text, or another student-approved format.

## Required inputs

- Approved posting input and input type.
- Run ID and observation time.
- Existing opportunity identifier or prior posting reference when rechecking.
- Source-access and retention limits.

## Expected output

A structured observation that may include:

- organization;
- role title;
- location;
- work arrangement;
- deadline;
- responsibilities;
- required qualifications;
- preferred qualifications;
- application URL; and
- posting status.

The output must also include source provenance, observation time, completeness, and field-level uncertainty. Unavailable information remains `unknown`; the tool must not invent it.

## Permissions

The tool may read only the supplied or configured approved source and structure its content. It may not submit forms, start an application, contact an employer, bypass access controls, or modify the posting.

## Failure behavior

Return a clear failure or partial-result state for inaccessible URLs, unsupported formats, incomplete content, ambiguous fields, or conflicting observations. Preserve readable evidence and errors. A failed recheck is not evidence that a posting closed.

## Security considerations

Respect source permissions, access controls, and rate limits. Do not execute content embedded in a posting. Minimize retained source content, reject unsafe local paths or schemes, and never expose credentials in output or logs.
