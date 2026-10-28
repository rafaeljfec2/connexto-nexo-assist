# ADR 0003 — Versioned HITL drafts and TicketGateway

## Status

Accepted

## Context

PRD requires the agent to propose actions while domain rules decide priority/SLA/duplicity, and ticket writes only after explicit confirmation. Exposing create/update/reopen/transfer as model tools would allow silent or incomplete mutations.

## Decision

1. Model tools may only `search_help`, `list_my_tickets`, `get_ticket`, and `prepare_draft`.
2. `prepare_draft` persists a versioned draft; confirmation requires exact `draftId` + `version` (button or allowed phrase).
3. All ticket mutations go through `TicketGateway` with idempotent `operationId` after confirm.
4. Incomplete create drafts are rejected (no silent defaults).

## Consequences

- Clear HITL audit trail and safe retries.
- UI and scripted flows must drive impact/clarification before a confirmable create draft.
- Slightly more turn steps than a “tool writes ticket” design — intentional for evaluation safety and Annex A compliance.
