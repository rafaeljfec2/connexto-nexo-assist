# ADR 0002 — Scripted LLM provider for CI

## Status

Accepted

## Context

Automated proof of agent decisions (HITL, handoff, consulta, UsageGuard) must be deterministic, offline-capable, and free of third-party token cost. Live OpenRouter/OpenAI models are non-deterministic and flaky in CI.

## Decision

Implement `ScriptedLlmProvider` (`apps/api/src/agent/providers/scripted.llm.provider.ts`) behind the same `LlmProvider` contract used by Mastra turns. Select it with `LLM_PROVIDER=scripted`. Integration tests and offline demos use this provider; Annex A and TicketGateway remain unchanged.

## Consequences

- CI proves orchestration, policy, and HITL without network keys.
- Scripted flows must be maintained when UX scripts change (VPN → impact → draft, consulta, transfer).
- Live-model quality is still available locally via OpenRouter/OpenAI; scripted is not a substitute for product LLM evaluation, only for automated evidence.
