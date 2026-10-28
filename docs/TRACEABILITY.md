# Traceability Matrix

Maps PRD evaluation criteria and critical requirements to delivery frontiers, domain rules, and automated evidence.

| Criterion / Requirement | Obligation | Frontier | Implementation | Evidence |
|---|---|---|---|---|
| Decision quality — intent + Annex A | Agent proposes; domain code decides type, category, impact, urgency, priority, duplicity, transfer | 1, 4 | `@nexo-assist/domain` + `PolicyEngine` / `AgentOrchestrator` | Vitest domain suite; API scripted-LLM integration tests |
| Conversation conduct — ask only missing data | Clarification questions when priority/duplicity ambiguous | 1, 4 | `decidePriority`, `detectDuplicity`, orchestrator prompts | Domain tests + orchestrator tests |
| Draft confirmation by exact version | Mutations require `draftId` + `version` or explicit phrase | 1, 3, 4 | `evaluateConfirmation` + confirm endpoint | Domain confirmation tests; API idempotent confirm test |
| History after restart | Conversation/messages/events in Postgres | 2, 3 | Drizzle persistence | `api.integration.prd-v5-closure` TECH-6 re-read assertion |
| Transparency — actions above replies | UI lists orchestrator execution events with confidence | 4, 5 | `execution_events.confidence` + `EventChips` | Domain `deriveConfidence`; API persist; web chip detail |
| Out-of-IT redirect (AA-7) | RH / finance / facilities never draft | 1, 4 | `detectOutOfItScope` + early turn gate | Domain out-of-scope tests; API PRD closure |
| Unsure handoff offer (AA-5 / HA-2) | Low confidence stalls offer analyst; structured summary | 4, 6 | `transfer.offer_unsure` + `buildHandoffSummary` | API PRD closure + handoff-summary unit |
| Ticket fault resilience (CTX-2) | Short retry + clear 503 | 2 | `TicketGateway.withFaultRetry` | API fault_once / unavailable tests; web 503 UX |
| Create draft completeness (AA-3) | No silent defaults; confirm rejects incomplete | 1, 4 | `assertCreateDraftComplete` | Domain draft-complete; API HITL reject |
| Interface fidelity — five screens | Login, chat, overdue card, console queue, human attendance | 5, 6 | `apps/web` | Playwright five flows |
| Console L1–L4 / T1–T3 / A1–A4 | See `docs/SPEC_CONSOLE_ATENDENTE.md` | 6 | Console panes + `ConsoleService` | Integration return-from-waiting; Playwright claim flow |
| Architecture separation | Web / agent / tickets separated by contract | 2, 4 | `@mastra/core` Agent tools call `TicketGateway` / help search only — no ticket repo import | Module boundary + typecheck |
| Agent stack (PRD) | Mastra (preference) or LangGraph.js | 4 | `@mastra/core` `Agent` + `createTool` + `generate` in `apps/api`; scripted bypass for CI | Dependency in `apps/api/package.json`; integration tests with `LLM_PROVIDER=scripted` |
| Strict typing, no `any` | TypeScript strict across packages | 1–6 | `tsconfig.base.json` | `pnpm typecheck` |
| Privacy — own tickets only | Employee cannot read another employee's ticket | 2, 3 | `TicketGateway` owner check | Integration test (INC-20150) |
| Concurrent analyst claim | Second claim conflicts | 6 | Conditional `UPDATE` on `waiting_analyst` | Integration race test |
| Return waiting to agent | Analyst may bounce `waiting_analyst` → `with_agent` without claim | 6 | `ConsoleService.returnToAgent` | Integration return-from-waiting |
| Agent paused with analyst | No auto agent reply in `waiting_analyst` / `with_analyst` / `closed` | 4 | Orchestrator status gate | API unit/integration test |
| 31st employee message | Rejected without model call | 3 | `UsageGuard` | Integration test with mock provider counter |
| Tool step ceiling | 5th tool step does not execute | 4 | Orchestrator step limiter | Integration/unit test |
| Communication | README documents run, decisions, proof, trade-offs | 7 | `README.md`, `.env.example`, Compose; deeper notes in `docs/README.md` | Manual review |
| Deploy | Out of scope (differential) | — | — | Documented as deferred |
| Consulta C1–C9 — status → list → select → overdue | See `docs/SPEC_CONSULTA_CHAMADO.md` | 4, 5 | Orchestrator `get_ticket` + `ticket.inspect` / `sla.compute_due`; chat picker + detail card | Integration consulta flow; chip-label unit tests; Playwright consulta |

## Screen 2 — Consulta de chamado (frozen)

| Rule ID | Obligation | Implementation | Evidence |
|---|---|---|---|
| C1 | List only own open tickets on status intent | `list_my_tickets` + UI filter `status !== resolved` | Integration: three open for Ana |
| C2 | Ambiguity asks which ticket | Scripted reply after list | Integration / Playwright |
| C3 | Compact list: number, title, status color, short date | `TicketCard` compact | Unit/UI |
| C4 | Selection sends turn; inspect + SLA chips | `sendContent`; `get_ticket` + `ticket.inspect` + `sla.compute_due` | Integration selection turn |
| C5 | Detail card with description, relative `updatedAt`, overdue | Chat detail mapping | Integration overdue INC-20311 |
| C6 | Overdue actions send or clear | Chat action handlers | Playwright / unit |
| C7 | Turn-scoped expandable chips | `EventChips` | Chip label unit tests |
| C8 | `n/30` + backend block | UsageGuard + footer | Existing 31st-message test |
| C9 | Online vs paused pill | Chat `StatusPill` | Existing pause tests |

## Annex A rule map

| Rule | Module | Test file |
|---|---|---|
| Priority (critical / high / medium / low / ask) | `packages/domain/src/priority.ts` | `priority.test.ts` |
| SLA due dates (critical calendar; others business hours) | `packages/domain/src/sla.ts` | `sla.test.ts` |
| Reopen within 168 hours inclusive | `packages/domain/src/sla.ts`, `transitions.ts` | `sla.test.ts`, `transitions.test.ts` |
| Duplicity thresholds 0.5 / 0.3 | `packages/domain/src/duplicity.ts` | `duplicity.test.ts` |
| Complement / reopen / transfer transitions | `packages/domain/src/transitions.ts` | `transitions.test.ts` |
| Confirmation phrases vs weak affirmations | `packages/domain/src/confirmation.ts` | `confirmation.test.ts` |
| Consulta C1–C9 helpers (overdue, relative dates) | `packages/domain/src/consulta.ts` | `consulta.test.ts` |
| Create draft completeness (AA-3) | `packages/domain/src/draft-complete.ts` | `draft-complete.test.ts` |
| Out-of-IT scope (AA-7) | `packages/domain/src/out-of-scope.ts` | `out-of-scope.test.ts` |
| Confidence / grau de segurança (BUILD-7) | `packages/domain/src/confidence.ts` | `confidence.test.ts` |

## Seed fixtures used as acceptance anchors

| Fixture | Purpose |
|---|---|
| `ana.souza@nexo.com.br` | Primary employee demo identity |
| Analyst Rafael Lima | Console claim / return / close |
| Ana Souza waiting · INC-20311 | Console Pencil featured conversation |
| `INC-20311` | Overdue card + transfer options (screen 3) + console sidebar |
| `INC-20298` | Multi-ticket list |
| `REQ-10442` | Approved still open (second monitor) |
| `INC-20150` | Cross-employee privacy |
| Ana resolved in/out of 7 days | Reopen window |
| Eight help articles | Textual help-center search without vector RAG |
