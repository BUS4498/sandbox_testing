# Action Memory Specification

## What is stored

Action memory records attempted and completed actions, such as:

- spreadsheet row added;
- spreadsheet row updated;
- email notification attempted;
- email notification submitted or sent;
- daily schedule updated;
- communication draft prepared; and
- student approval requested.

Each record should include action ID, opportunity and decision IDs, timestamp, action type, target, intended effect, approval reference when required, idempotency key, attempt number, tool result or error, and provisional status.

## Why it is needed

Action memory provides an audit trail and prevents duplicate spreadsheet writes, repeated notifications, repeated approval requests, and other duplicated external or local side effects.

## When it is written

Write an action record before or at the start of an attempted side effect, then append its returned result. Record failures and unknown outcomes as well as successful attempts. Final success is determined in evaluation memory.

## When it is retrieved

Retrieve relevant actions before **ACT**, before any retry, during duplicate checks, and when **VERIFY** needs the original intended effect or receipt.

## How it influences future cycles

Action memory tells later cycles what was already attempted, which idempotency key was used, and whether repetition could create a duplicate. An unknown prior outcome blocks unsafe retry until it is resolved or escalated.
