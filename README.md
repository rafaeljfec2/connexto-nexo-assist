# Nexo Assist

Conversational IT service desk for the Beyond the Bytes technical challenge. Employees chat with an agent that proposes actions; a deterministic policy engine decides priority, SLA, duplicity and confirmation; ticket writes happen only after an exact draft version is confirmed.

Deeper engineering notes: [`docs/README.md`](docs/README.md).

## Prerequisites

- Node.js `>=20` (see `engines` in root `package.json`)
- pnpm `11.12.0` (see `packageManager` in root `package.json`)
- Docker + Docker Compose (Postgres locally, or full-stack Compose)

## Quick start

### Local (pnpm)

```bash
pnpm install
docker compose up -d postgres
cp .env.example .env
# optional: set OPENROUTER_API_KEY (default) or OPENAI_API_KEY for a real model
pnpm db:migrate
pnpm db:seed
pnpm dev
```

`pnpm db:migrate` / `pnpm db:seed` are root shortcuts for the API package. Re-running seed when `seed_meta` already has `nexo-assist-demo-v4` skips without duplicating users.

### Full stack (Docker)

```bash
cp .env.example .env
docker compose up --build
```

API image runs migrate + idempotent seed on start.

- Web: http://localhost:3000
- API: http://localhost:3001
- Postgres: `postgres://nexo:nexo@localhost:5432/nexo`

### Environment (`.env.example`)

| Variable | Role |
|---|---|
| `DATABASE_URL` | Postgres connection |
| `API_PORT` / `NEXT_PUBLIC_API_URL` | API listen port and browser base URL |
| `SESSION_SECRET` | Session cookie signing |
| `CORS_ORIGIN` | Allowed web origin (default `http://localhost:3000`) |
| `LLM_PROVIDER` | `openrouter` (default) \| `openai` \| `scripted` |
| `OPENROUTER_*` / `OPENAI_*` | Keys and models for live providers |
| `TICKET_FAULT` | `off` \| `unavailable` \| `fail_once` — ticket gateway fault injection |
| `LOG_LEVEL` | Nest verbosity; agent business traces use context `AgentTrace` (`grep AgentTrace`) |

### LLM choice (TECH-3)

We run `@mastra/core` (`Agent` + `createTool` + `generate`) inside the Nest API process. The PRD prefers Mastra (or LangGraph.js); we picked Mastra because this product needs a short tool-calling loop, not a second orchestration graph — Nest already owns session, lease, HITL and persistence. LangGraph would duplicate that job for little gain here.

- **Default `openrouter`** + free Nemotron: real chat for evaluators without burning budget.
- **`openai`**: same path when you already have an OpenAI key/model.
- **`scripted`**: no network and no tokens — how CI proves the pipeline. Decision *quality* still comes from `@nexo-assist/domain` and integration tests, not from hoping the model is stable in CI.

## Acesso à aplicação

Two functional profiles are seeded for evaluators. There is no public signup and no admin panel.

| Email | Profile | Purpose |
|---|---|---|
| `ana.souza@nexo.com.br` | `employee` | Chat, ticket consult, handoff to analyst |
| `rafael.lima@nexo.com.br` | `analyst` | Attendance console (claim / return / close) |
| `bruno.mendes@nexo.com.br` | `employee` | Extra employee fixture (privacy / race) |
| `carla.nunes@nexo.com.br` | `employee` | Extra employee fixture (console queue) |

**Demo password rule (evaluation only):** any non-empty password is accepted for seeded emails (for example `demo`). Unknown email and empty password share one generic error. Passwords are not stored — the users table has no password column.

### Sign in as employee

1. Open http://localhost:3000/login
2. Use `ana.souza@nexo.com.br` and any non-empty password
3. You land on `/chat` — test conversation with the agent, ticket list/consulta, draft confirmation, and handoff phrases

### Sign in as analyst

1. Open http://localhost:3000/login
2. Use `rafael.lima@nexo.com.br` and any non-empty password
3. You land on `/console` — test queue filters, claim, return to agent, close, and analyst messages

Role comes from the authenticated session on the API (`EmployeeGuard` / `AnalystGuard`). Hiding menus is not the security boundary.

### Demo limitations

- Demo auth only (see password rule above) — not production auth
- Session cookie TTL is 15 minutes; “Manter conectado” does not extend it
- No MFA, rate limits, or password recovery
- “Suporte N2” in the console is a transfer destination label, not a login role
- No N1/N2 analyst hierarchy in auth

## How the agent decides

1. Session resolves the employee; client-supplied user ids are ignored.
2. `UsageGuard` enforces 30 employee messages / conversation, 4000 chars, one in-flight execution (atomic `busyUntil` claim), max 4 tool steps, last-10-message context, 20s provider timeout, 600 max output tokens. An open `waiting_analyst` / `with_analyst` conversation is reused — the API never opens a fresh `with_agent` thread to bypass pause or the message budget.
3. Production turns use `@mastra/core`. Model routing: `openrouter/<OPENROUTER_MODEL>` or `openai/<OPENAI_MODEL>`. Tools are only `search_help`, `list_my_tickets`, `get_ticket`, and `prepare_draft`. `LLM_PROVIDER=scripted` keeps a deterministic loop for CI without calling the model.
4. `@nexo-assist/domain` applies Annex A: priority, business-hour SLA (`America/Sao_Paulo`), duplicity thresholds, reopen window (168h inclusive), and draft confirmation phrases.
5. Mutations go through `TicketGateway` with `operationId` idempotency (create runs in a DB transaction). Create / update / reopen / transfer are never model tools.
6. Human handoff: explicit phrase (e.g. “quero falar com um analista”), critical priority (direct transfer), overdue/low-confidence stalls **offer** an analyst (chip + phrase; not silent auto-transfer). Accepted offers store a structured summary for the console.
7. Execution events are persisted with deterministic confidence (`high` / `medium` / `low`) and shown as expandable chips (intent, tool, rule, result, grau de segurança, justification).
8. Non-IT topics (RH / financeiro / facilities) are redirected without creating drafts. Incomplete create drafts are never confirmed (no silent defaults).
9. Agent turns also emit Nest `Logger` lines under context `AgentTrace` (`turn.started` → `turn.event` rules/tools → `turn.completed` / `turn.failed`, plus `draft.confirm`). Filter API stdout with `grep AgentTrace`. Set `LOG_LEVEL=debug` for more Nest verbosity (default `log`).

## How decision quality was proven

| Layer | Command | What it covers |
|---|---|---|
| Domain | `pnpm --filter @nexo-assist/domain test` | Priority, SLA, duplicity, transitions, confirmation, out-of-IT, confidence, draft completeness |
| API + Postgres | `LLM_PROVIDER=scripted pnpm --filter @nexo-assist/api test` | Owner privacy, HITL, out-of-IT, unsure offer, ticket fault retry, conversation reload |
| UI unit | `pnpm --filter @nexo-assist/web test` | Event labels + chat derivations |
| UI e2e | Install browsers once: `pnpm --filter @nexo-assist/web exec playwright install` — then with apps running: `pnpm --filter @nexo-assist/web test:e2e` | Login, chat, console claim, consulta |
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

Agent module layout and decision ADRs: [`docs/agent.md`](docs/agent.md), [`docs/architecture.md`](docs/architecture.md).

## Product readings documented from the PRD

- Time zone `America/Sao_Paulo`; business hours Mon–Fri 08:00–18:00 (10h/day). No holiday calendar.
- Critical SLA: 1 calendar hour. High/medium/low: 4 / 30 / 50 business hours. Due date recalculated on each update.
- Reopen: `now <= resolvedAt + 168h`. Does not create a new ticket.
- Duplicity: unresolved tickets of the same owner; strong ≥ 0.5 or equal error code; ambiguous 0.3–0.5; below 0.3 not duplicate.
- Session cookie `httpOnly` + `SameSite=Lax`; TTL 15 minutes.
- Demo auth: see **Acesso à aplicação** above.

## Deploy

| Surface | Where | URL |
|---|---|---|
| Web (`apps/web`) | Vercel project `nexo-assist` | https://nexo-assist.connexto.com.br |
| API (`apps/api`) | FlowDeploy (`connexto-nexo-assist-api` on the Outcoders VPS) | https://api-nexo-assist.connexto.com.br |

API health: `GET https://api-nexo-assist.connexto.com.br/health/live`. Production CORS allows the web origin above. LLM keys and `SESSION_SECRET` stay in the host env (not in the repo). Manifests: `apps/api/paasdeploy.json` + Traefik labels in `apps/api/docker-compose.yml`.

## Trade-offs and what would come next

- Mastra stays a library inside Nest (not LangGraph, not an agent microservice). Annex A lives in `@nexo-assist/domain` so priority/SLA/duplicity stay deterministic and unit-testable without calling a model. Ticket writes only go through `TicketGateway` after an exact draft version is confirmed.
- Help search matches tokens/error codes. Vector RAG would help fuzzy questions, but the seeded help center is small enough that a simpler search kept the delivery honest and testable.
- Playwright covers smoke paths; with more time we would harden the five scripted UI flows (including the overdue card) against the seed fixtures.
- Production-grade auth (real passwords, MFA, rate limits) and richer deploy observability are the main deferred differentials — enough for the challenge, not a full SaaS hardening pass.

## Useful commands

```bash
pnpm dev
pnpm test
pnpm lint
pnpm typecheck
pnpm build
pnpm db:migrate
pnpm db:seed
```
