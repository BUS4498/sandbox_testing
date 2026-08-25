# Evaluation Memory Specification

## Purpose

Record whether an action, decision, or assessment achieved its intended observable result and what should change next time.

## Record fields

- Evaluation ID, run ID, and evaluated record ID/type.
- Intended result and verification method.
- Observed result and evidence reference.
- Outcome: `confirmed`, `partially_confirmed`, `failed`, `unknown`, or `not_verifiable`.
- Evaluation time and evaluator/tool.
- Quality or policy findings.
- Retry, remediation, or student task created.
- Prior evaluation superseded, if any.

## Rules

Do not collapse provider acceptance into delivery, an attempted write into a saved record, or a recommendation into a correct prediction. Later evidence may supersede an evaluation through a new linked record; history remains recoverable.

