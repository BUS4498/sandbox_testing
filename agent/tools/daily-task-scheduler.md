# Daily Task Scheduler — Tool Contract

## Status

Specification only; no scheduler or background service is implemented.

## Responsibility

Maintain an optional student-configured daily trigger for the same agent lifecycle used by Run Now.

## Configuration

- Enabled state, default `false`.
- Student-selected local time and IANA timezone.
- Next calculated run and last trigger result.
- Pause/disable state and configuration version.

## Operations

Enable, update, pause, disable, inspect, and calculate the next run. Schedule changes require explicit student action in the local dashboard.

## Constraints

- Scheduling grants no additional permissions.
- Prevent overlapping runs through a local lock and surface a skipped/consolidated trigger.
- Handle sleep, restart, daylight-saving changes, and missed runs without silently running repeatedly.
- Default missed-run behavior should request or follow a student-visible configuration rather than assume catch-up authority.
- Keep scheduler state local.

## Verification

After a configuration change, re-read the registered state and show enabled status, timezone, and next planned run. A calculated next run is not proof that the operating system will execute it.

