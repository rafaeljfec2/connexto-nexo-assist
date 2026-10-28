# ADR 0001 — Mastra in-process inside Nest

## Status

Accepted

## Context

PRD v5 prefers Mastra (or LangGraph.js) for the agent runtime. The Nest API already owns sessions, UsageGuard, Postgres access, and TicketGateway. Splitting the agent into a second service would add network hop, duplicate auth/context, and complicate the evaluation “few commands” story.

## Decision

Run `@mastra/core` (`Agent` + `createTool` + `generate`) **inside** the Nest API process under `apps/api/src/agent/providers/mastra.ts`. Do not introduce LangGraph.js or a standalone agent microservice for this delivery.

## Consequences

- Single deployable API process; simpler local run and Compose.
- Agent shares Nest DI for `PolicyEngine`, DB, and gateway — boundaries enforced by module layout and tool allow-list, not by network.
- Provider swap (`openrouter` / `openai` / `scripted`) stays an env concern without changing process topology.
