# SPEC — HTTP commands + SSE events (Nexo Assist)

Frozen obligations for asynchronous employee turns and real-time conversation delivery.

## Architecture (A1–A5)

| ID | Obligation |
|---|---|
| A1 | Postgres remains the system of record. Commands use HTTP; live deltas use SSE. |
| A2 | No Redis, WebSockets, external queues, or microservices for this path. |
| A3 | Agent execution stays in-process on the NestJS API. |
| A4 | `conversation_events` is durable; Postgres `NOTIFY` is ephemeral fan-out only. |
| A5 | Cursor is **per conversation** (`seq`), never a global `BIGSERIAL` stream. |

## Event cursor (C1–C4)

| ID | Obligation |
|---|---|
| C1 | `conversations.last_event_seq` starts at 0 and increases by 1 per appended event. |
| C2 | Every append locks the conversation row (`SELECT … FOR UPDATE`), increments `last_event_seq`, inserts `(conversation_id, seq)`, and commits business mutations in the same transaction. |
| C3 | `Last-Event-ID` on SSE is the conversation-local `seq` (integer string). |
| C4 | For a fixed `conversation_id`, commit order equals `seq` order (no consumable holes from concurrent writers). |

## Event types (E1–E7)

| ID | Type | Meaning |
|---|---|---|
| E1 | `message.created` | A message row was persisted (`role`, `messageId`, optional `clientMessageId`, `content` summary fields). |
| E2 | `agent.started` | Accept claimed a lease; execution began (`executionId`). |
| E3 | `agent.completed` | Fenced agent outcome persisted (`executionId`, `messageId`). |
| E4 | `agent.failed` | Execution ended without a usable reply (`executionId`, `reason`). |
| E5 | `agent.incomplete` | Lease expired without an agent reply for that execution (`executionId`, `reason=lease_expired`). |
| E6 | `conversation.updated` | Status / analyst assignment changed (`status`, `analystId`, …). |
| E7 | `sync.required` | SSE control frame only (not durable): replay hit the 500-event cap; client must `GET /conversations/current` (or console hydrate). |

Payload `version` is an integer (starts at 1) for forward-compatible schema evolution.

## HTTP accept (H1–H6)

| ID | Obligation |
|---|---|
| H1 | `POST /conversations/current/messages` accepts the employee message and returns immediately without a synchronous `agentMessage`. |
| H2 | Request may include optional `clientMessageId` (UUID). Recommended for the web client. |
| H3 | Response includes at least `{ accepted, executionId, clientMessageId, employeeMessage, employeeMessageCount }`. `executionId` is null when no agent run is scheduled (e.g. `with_analyst`). |
| H4 | While `busy_until` is in the future, a second message returns **409**. |
| H5 | Retry with the same `clientMessageId` returns the previously accepted employee message and does **not** start a second turn (UNIQUE `(conversation_id, client_message_id)`). |
| H6 | After lease expiry, a new accept may start even if a zombie still holds `active_execution_id`; fencing blocks the zombie from persisting. |

## Fencing / lease (F1–F5)

| ID | Obligation |
|---|---|
| F1 | Accept (agent path) sets `active_execution_id` and `busy_until ≈ now + (MAX_TOOL_STEPS × PROVIDER_TIMEOUT_MS + 5s)`, inserts the employee message + `message.created` + `agent.started`, commits, `NOTIFY`, then `setImmediate(runExecution)`. |
| F2 | Persist agent outcome only with `UPDATE … WHERE id = $c AND active_execution_id = $exec AND status = 'with_agent'`. Zero rows → discard (no agent message / no completion events). |
| F3 | `claim` / `return` / `close` clear `active_execution_id` and `busy_until` in the same transaction as the status change. |
| F4 | MVP has no auto-rerun sweeper; incomplete turns are signaled via `agent.incomplete` and/or client timeout + safe retry. |
| F5 | While this process still holds an in-memory pending run for `executionId`, **do not** emit `agent.incomplete` nor clear that execution’s lease (prevents discarding a still-running turn after wall-clock lease expiry). |

## SSE protocol (S1–S8)

| ID | Obligation |
|---|---|
| S1 | `GET /conversations/:id/events` — employee must own the conversation; cookie auth (`EventSource` with credentials). |
| S2 | `GET /console/events` — analyst only; optional `conversationId` query filter. |
| S3 | Subscribe first (local buffer), then replay `seq > afterSeq` ordered by `seq` (limit 500). |
| S4 | Missing `Last-Event-ID` / `afterSeq` → `afterSeq = 0`. Non-numeric → 400. When both are present and numeric, use `max(afterSeq, Last-Event-ID)`. Initial EventSource connects may pass `?afterSeq=`; reconnects should advance via `Last-Event-ID`. |
| S5 | If replay returns 500 rows → emit `sync.required` and stop relying on further replay alone. |
| S6 | Delivery is at-least-once; clients dedupe by `seq` within the conversation. |
| S7 | Heartbeat comment `: ping` about every 15s. |
| S8 | Authz is checked on open; mid-stream logout / foreign claim is best-effort. |

## Web UX (U1–U4)

| ID | Obligation |
|---|---|
| U1 | After accept, UI shows a processing state keyed by `executionId` / pending employee message. |
| U2 | Client timeout (~30s) without `agent.completed` / agent `message.created` surfaces a recoverable incomplete state. |
| U3 | Network retry of the same accept uses the **same** `clientMessageId`. A new agent attempt after a failed/incomplete turn uses a **new** `clientMessageId` with the same text. |
| U4 | `GET /conversations/current` remains the snapshot authority; SSE is delta. |

## Out of MVP

- Auto-rerun of abandoned executions
- LLM token streaming
- Exactly-once network delivery
- Long-term purge job for `conversation_events` (replay cap + `sync.required` is enough)
- Multi-process OS e2e as production proof (integration may cover two LISTEN hubs + real Postgres as level B)

## Evidence

| Claim | Success type | Evidence path | Budget |
|---|---|---|---|
| In-process pending run is not cleared by lease-expiry incomplete (F5) | test | `apps/api/test/agent.lease.integration.test.ts` | 1 failing→green case: busyUntil past + pendingRuns → lease kept; after await, agent message persisted |
| SSE afterSeq resolution prefers max(query, header) when both numeric (S4) | test | `apps/api/test/sse-after-seq.unit.test.ts` | 1 case both present |
| File size ≤ 400 LOC for production modules touched | command | `wc -l` on refactored modules | all ≤ 400 |
