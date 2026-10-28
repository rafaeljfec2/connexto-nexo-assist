# Nexo Assist

Conversational IT service desk for the Beyond the Bytes technical challenge. Employees chat with an agent that proposes actions; a deterministic policy engine decides priority, SLA, duplicity and confirmation; ticket writes happen only after an exact draft version is confirmed.

## Quick start

### Local (pnpm)

```bash
pnpm install
docker compose up -d postgres
cp .env.example .env
# optional: set OPENAI_API_KEY for a real model
pnpm --filter @nexo-assist/api db:migrate
pnpm --filter @nexo-assist/api db:seed
pnpm dev
```

### Full stack (Docker)

```bash
cp .env.example .env
docker compose up --build
```

API image runs migrate + idempotent seed on start. Web and API images follow the same multi-stage pnpm pattern used in `connexto-digital-signer`.

- Web: http://localhost:3000  
- API: http://localhost:3001  
- Postgres: `postgres://nexo:nexo@localhost:5432/nexo`

Demo logins (any non-empty password):

| Email | Role |
|---|---|
| `ana.souza@nexo.com.br` | Employee |
| `rafael.lima@nexo.com.br` | Analyst |
| `bruno.mendes@nexo.com.br` | Employee |
| `carla.nunes@nexo.com.br` | Employee |

Without `OPENAI_API_KEY`, set `LLM_PROVIDER=scripted` in `.env` so the chat uses the deterministic provider (also used by tests).

## How the agent decides

1. Session resolves the employee; client-supplied user ids are ignored.
2. `UsageGuard` enforces 30 employee messages / conversation, 4000 chars, one in-flight execution (atomic `busyUntil` claim), max 4 tool steps, last-10-message context, 20s provider timeout, 600 max output tokens. An open `waiting_analyst` / `with_analyst` conversation is reused — the API never opens a fresh `with_agent` thread to bypass pause or the message budget.
3. Production turns use `@mastra/core` (`Agent` + `createTool` + `generate`, model `openai/<OPENAI_MODEL>`). Tools are only `search_help`, `list_my_tickets`, `get_ticket`, and `prepare_draft`. `LLM_PROVIDER=scripted` keeps a deterministic loop for CI without calling the model.
4. `@nexo-assist/domain` applies Annex A: priority, business-hour SLA (`America/Sao_Paulo`), duplicity thresholds, reopen window (168h inclusive), and draft confirmation phrases.
5. Mutations go through `TicketGateway` with `operationId` idempotency (create runs in a DB transaction). Create / update / reopen / transfer are never model tools.
6. Human handoff requires an explicit phrase (e.g. “quero falar com um analista”) or a critical-priority policy decision — not a bare “analista” substring.
7. Execution events are persisted and shown as chips above agent replies.

## How decision quality was proven

| Layer | Command | What it covers |
|---|---|---|
| Domain | `pnpm --filter @nexo-assist/domain test` | Priority, SLA, duplicity, transitions, confirmation |
| API + Postgres | `LLM_PROVIDER=scripted pnpm --filter @nexo-assist/api test` | Owner privacy, idempotency, 31st message, claim race, scripted tools, paused agent |
| UI smoke | `pnpm --filter @nexo-assist/web test` (Playwright; apps must be running) | Login, employee chat shell, analyst console |
| Types / build | `pnpm typecheck` / `pnpm build` | Strict TypeScript across packages |

Traceability: [`docs/TRACEABILITY.md`](docs/TRACEABILITY.md).

## Architecture

```
apps/web          Next.js employee chat + analyst console
apps/api          NestJS session, UsageGuard, orchestrator, TicketGateway
packages/domain   Pure Annex A rules (no framework, no LLM)
packages/contracts Shared Zod schemas
```

PostgreSQL is the source of truth for users, sessions, conversations, messages, drafts, tickets, history, help articles, operations and execution events. `localStorage` is not used as authority.

## Product readings documented from the PRD

- Time zone `America/Sao_Paulo`; business hours Mon–Fri 08:00–18:00 (10h/day). No holiday calendar.
- Critical SLA: 1 calendar hour. High/medium/low: 4 / 30 / 50 business hours. Due date recalculated on each update.
- Reopen: `now <= resolvedAt + 168h`. Does not create a new ticket.
- Duplicity: unresolved tickets of the same owner; strong ≥ 0.5 or equal error code; ambiguous 0.3–0.5; below 0.3 not duplicate.
- Session cookie `httpOnly` + `SameSite=Lax`; TTL 15 minutes.
- Demo auth: seeded email + any non-empty password; unknown email and empty password share one generic error.
- Deploy is out of scope for this delivery.

## Trade-offs and what would come next

- The agent uses `@mastra/core` inside the Nest API process (not a second microservice or LangGraph). Ticket mutations stay behind `TicketGateway` + HITL; Annex A stays in `@nexo-assist/domain`. Scripted provider covers automated proof without OpenAI cost.
- Help search is token/error-code based, not vector RAG.
- Playwright covers smoke paths; expanding to the full five scripted flows with seeded overdue-card assertions would be the next UI hardening step.
- Production auth (real passwords, MFA, rate limits) and deploy/observability remain deferred differentials.

## Useful commands

```bash
pnpm dev
pnpm test
pnpm lint
pnpm typecheck
pnpm build
pnpm --filter @nexo-assist/api db:migrate
pnpm --filter @nexo-assist/api db:seed
```
