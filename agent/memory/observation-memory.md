# Observation Memory Specification

## Purpose

Preserve what was observed from postings, local files, tools, and student input with sufficient provenance to distinguish evidence from inference.

## Record fields

- Observation ID, run ID, source type, and source identifier.
- Retrieval ID, observed/retrieved time, and content hash or local reference.
- Entity and field observed.
- Original excerpt or structured value within retention limits.
- Interpretation status: `stated`, `derived`, `unknown`, `conflicting`, or `not_applicable`.
- Freshness, completeness, and extraction confidence.
- Prior observation ID and detected change class.
- Materiality result and rationale.

## Rules

Observations are append-only and immutable except for documented redaction or deletion. A failed retrieval creates an availability observation, not evidence that the posting or requirement no longer exists.

