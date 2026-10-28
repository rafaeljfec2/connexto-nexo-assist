# Local development

Canonical quick start lives in the root [`README.md`](../README.md). This page covers common failures and evaluator-oriented toggles.

## Prerequisites checklist

- Node.js `>=20`
- pnpm `11.12.0` (`corepack enable` if needed)
- Docker running (for Postgres or full Compose)

## Postgres only + pnpm apps

```bash
pnpm install
docker compose up -d postgres
cp .env.example .env
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Expected URLs: web `http://localhost:3000`, API `http://localhost:3001`.

If migrate fails with connection refused, confirm Compose Postgres is healthy and `DATABASE_URL` matches `.env.example`.

## LLM modes

| Goal | Setting |
|---|---|
| Free live model (default) | `LLM_PROVIDER=openrouter` + `OPENROUTER_API_KEY` |
| OpenAI | `LLM_PROVIDER=openai` + `OPENAI_API_KEY` |
| Offline / CI / deterministic demos | `LLM_PROVIDER=scripted` (no keys) |

API automated tests expect scripted:

```bash
LLM_PROVIDER=scripted pnpm --filter @nexo-assist/api test
```

## Fault injection

`TICKET_FAULT` in `.env` (also documented in `.env.example`):

| Value | Behavior |
|---|---|
| `off` | Normal |
| `fail_once` | First ticket call fails once; retry succeeds (CTX-2) |
| `unavailable` | Ticket gateway stays unavailable → clear 503 path |

## Logs

- Nest levels: `LOG_LEVEL=error|warn|log|debug` (default `log`).
- Agent decision/tool traces: context `AgentTrace` — `grep AgentTrace` on API stdout.

## Playwright e2e

1. Start apps (`pnpm dev` or Compose).
2. Install browsers once: `pnpm --filter @nexo-assist/web exec playwright install`
3. Run: `pnpm --filter @nexo-assist/web test:e2e`

## Seed identities

See README **Acesso à aplicação**. Seed id is `nexo-assist-demo-v4` (idempotent skip when already applied).

## Useful root scripts

```bash
pnpm dev
pnpm test
pnpm typecheck
pnpm build
pnpm db:migrate
pnpm db:seed
```
