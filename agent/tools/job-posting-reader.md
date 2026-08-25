# Job Posting Reader — Tool Contract

## Status

Specification only; no reader or external integration is implemented.

## Responsibility

Read a student-approved posting source and return source-grounded content without applying for the role or interacting with the employer.

## Inputs

- Source URL or local file reference.
- Retrieval timestamp, run ID, and optional prior content hash.
- Configured access and retention limits.

## Outputs

- Source identifier and canonical URL when available.
- Retrieval status and timestamp.
- Readable content or a permitted local reference to it.
- Content hash, posting identifier when stated, and access/error metadata.

## Constraints

- Respect access controls, site terms, rate limits, and configured source scope.
- Do not bypass authentication or anti-automation controls.
- Do not infer missing posting text or claim freshness after a failed retrieval.
- Reading a posting must not trigger an application or other external mutation.

## Verification

Success requires readable content plus provenance. Redirects, partial pages, expired postings, and blocked access are explicitly reported.

