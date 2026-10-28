# Documentation index

The root [`README.md`](../README.md) is the **evaluation deliverable** required by PRD v5 (DEL-2): how to run, architecture overview, how the agent decides, quality proof, trade-offs, and what would come next. Keep that file self-contained for reviewers.

This folder holds deeper engineering notes. Nothing here replaces the README checklist.

## Start here

| Audience | Read |
|---|---|
| Evaluator / first local run | Root [`README.md`](../README.md) + [`.env.example`](../.env.example) |
| Troubleshooting local setup | [`local-development.md`](./local-development.md) |
| System boundaries | [`architecture.md`](./architecture.md) |
| Agent internals | [`agent.md`](./agent.md) |
| Requirement → code → test map | [`TRACEABILITY.md`](./TRACEABILITY.md) |

## Frozen product specs

| Spec | Scope |
|---|---|
| [`SPEC_CONSOLE_ATENDENTE.md`](./SPEC_CONSOLE_ATENDENTE.md) | Analyst console L1–L4 / T1–T3 / A1–A4 |
| [`SPEC_CONSULTA_CHAMADO.md`](./SPEC_CONSULTA_CHAMADO.md) | Ticket consulta C1–C9 |
| [`SPEC_HTTP_SSE.md`](./SPEC_HTTP_SSE.md) | HTTP + SSE realtime contract |
| [`specs/PRD-V5-COMPLIANCE-CLOSURE.md`](./specs/PRD-V5-COMPLIANCE-CLOSURE.md) | Closure scenarios B1–B6 |

## Architecture Decision Records

| ADR | Decision |
|---|---|
| [`adr/0001-mastra-in-process.md`](./adr/0001-mastra-in-process.md) | Mastra in-process inside Nest (not LangGraph / not a separate agent service) |
| [`adr/0002-scripted-llm-for-ci.md`](./adr/0002-scripted-llm-for-ci.md) | Scripted LLM provider for deterministic CI proof |
| [`adr/0003-hitl-draft-gateway.md`](./adr/0003-hitl-draft-gateway.md) | Versioned HITL drafts + TicketGateway; no mutation tools |

## Compliance reports (working notes)

Internal audit artifacts live under [`reports/`](../reports/) (Portuguese). They are not PRD deliverables.
