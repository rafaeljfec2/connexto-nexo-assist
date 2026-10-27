# Traceability Matrix

Maps PRD evaluation criteria and critical requirements to delivery frontiers, domain rules, and automated evidence.

| Criterion / Requirement | Obligation | Frontier | Implementation | Evidence |
|---|---|---|---|---|
| Decision quality — intent + Annex A | Agent proposes; domain code decides type, category, impact, urgency, priority, duplicity, transfer | 1, 4 | `@nexo-assist/domain` + `PolicyEngine` / `AgentOrchestrator` | Vitest domain suite; API scripted-LLM integration tests |
| Conversation conduct — ask only missing data | Clarification questions when priority/duplicity ambiguous | 1, 4 | `decidePriority`, `detectDuplicity`, orchestrator prompts | Domain tests + orchestrator tests |
| Draft confirmation by exact version | Mutations require `draftId` + `version` or explicit phrase | 1, 3, 4 | `evaluateConfirmation` + confirm endpoint | Domain confirmation tests; API idempotent confirm test |
| History after restart | Conversation/messages/events in Postgres | 2, 3 | Drizzle persistence | API integration reload assertion |
| Transparency — actions above replies | UI lists orchestrator execution events | 4, 5 | `execution_events` + chat chips | Playwright employee chat flow |
| Interface fidelity — five screens | Login, chat, overdue card, console queue, human attendance | 5, 6 | `apps/web` | Playwright five flows |
| Architecture separation | Web / agent / tickets separated by contract | 2, 4 | `TicketGateway`, no repo import from Mastra tools | Module boundary + typecheck |
| Strict typing, no `any` | TypeScript strict across packages | 1–6 | `tsconfig.base.json` | `pnpm typecheck` |
| Privacy — own tickets only | Employee cannot read another employee's ticket | 2, 3 | `TicketGateway` owner check | Integration test (INC-20150) |
| Concurrent analyst claim | Second claim conflicts | 6 | Conditional `UPDATE` on `waiting_analyst` | Integration race test |
| Agent paused with analyst | No auto agent reply in `waiting_analyst` / `with_analyst` / `closed` | 4 | Orchestrator status gate | API unit/integration test |
| 31st employee message | Rejected without model call | 3 | `UsageGuard` | Integration test with mock provider counter |
| Tool step ceiling | 5th tool step does not execute | 4 | Orchestrator step limiter | Integration/unit test |
| Communication | README documents run, decisions, proof, trade-offs | 7 | `README.md`, `.env.example`, Compose | Manual review |
| Deploy | Out of scope (differential) | — | — | Documented as deferred |

## Annex A rule map

| Rule | Module | Test file |
|---|---|---|
| Priority (critical / high / medium / low / ask) | `packages/domain/src/priority.ts` | `priority.test.ts` |
| SLA due dates (critical calendar; others business hours) | `packages/domain/src/sla.ts` | `sla.test.ts` |
| Reopen within 168 hours inclusive | `packages/domain/src/sla.ts`, `transitions.ts` | `sla.test.ts`, `transitions.test.ts` |
| Duplicity thresholds 0.5 / 0.3 | `packages/domain/src/duplicity.ts` | `duplicity.test.ts` |
| Complement / reopen / transfer transitions | `packages/domain/src/transitions.ts` | `transitions.test.ts` |
| Confirmation phrases vs weak affirmations | `packages/domain/src/confirmation.ts` | `confirmation.test.ts` |

## Seed fixtures used as acceptance anchors

| Fixture | Purpose |
|---|---|
| `ana.souza@nexo.com.br` | Primary employee demo identity |
| Analyst Rafael Lima | Console claim / return / close |
| `INC-20311` | Overdue card + transfer options (screen 3) |
| `INC-20298` | Multi-ticket list |
| `REQ-10442` | Approved still open (second monitor) |
| `INC-20150` | Cross-employee privacy |
| Ana resolved in/out of 7 days | Reopen window |
| Eight help articles | Textual help-center search without vector RAG |
