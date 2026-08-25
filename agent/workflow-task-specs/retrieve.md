# Retrieve Task Specification

## Purpose

Acquire current posting inputs, student context snapshots, prior tracker state, and relevant memory without changing external state.

## Inputs

- Run ID and trigger.
- Student-approved sources or saved opportunity URLs.
- Local tracker and memory locations.
- Current profile, preference, and constraint snapshot IDs.

## Procedure

1. Confirm each source is within configured scope.
2. Read local context and prior state before remote sources.
3. Retrieve source content with source URL or local path, retrieval time, and method.
4. Preserve the original observed content or a content hash where retention is permitted.
5. Mark unavailable, blocked, partial, or stale inputs; do not invent missing content.

## Output contract

For every item, return a stable retrieval ID, source identifier, observed time, content or reference, content hash when available, freshness status, and error details. Retrieval is read-only.

## Success and failure

Success means the input is readable and provenance is recorded. Partial retrieval remains partial. Authentication failures, access restrictions, malformed content, and unreachable sources become unresolved observations; they do not authorize bypassing access controls.

