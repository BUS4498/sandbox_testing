# Action Memory Specification

## What is stored

Action memory records attempted and completed actions, such as:

- web search performed;
- opportunity added to the spreadsheet;
- opportunity updated in the spreadsheet;
- notification attempted;
- Outlook email notification submitted or sent;
- student response recorded;
- application-template preparation requested;
- application template saved and verified;
- communication draft prepared; and
- student approval requested.

Each record should include action ID, opportunity and decision IDs, timestamp, action type, target, intended effect, approval reference when required, idempotency key, attempt number, tool result or error, and provisional status. Outlook actions may retain a non-secret tool-call receipt and masked recipient, but not the sender identity, token, or full message body.

A web-search action should retain the approved search scope, search time, query and result counts, tool outcome, and links to relevant structured observations. It should not duplicate unnecessary full web pages in action memory.

## Why it is needed

Action memory provides an audit trail and prevents duplicate spreadsheet writes, repeated notifications, repeated approval requests, and other duplicated external or local side effects.

## When it is written

Write an action record before or at the start of an approved web search or attempted side effect, then append its returned result. Record failures and unknown outcomes as well as successful attempts. Final success is determined in evaluation memory.

## When it is retrieved

Retrieve relevant actions before **ACT**, before any retry, during duplicate checks, and when **VERIFY** needs the original intended effect or receipt.

## How it influences future cycles

Action memory tells later cycles what was already attempted, which idempotency key was used, and whether repetition could create a duplicate. An unknown prior outcome blocks unsafe retry until it is resolved or escalated.
