# Addendum de conformidade PRD v5 — 2026-10-27 (pós B1–B6)

**Base:** [`PRD-V5-COMPLIANCE-REVIEW.md`](./PRD-V5-COMPLIANCE-REVIEW.md)  
**SPEC:** [`docs/specs/PRD-V5-COMPLIANCE-CLOSURE.md`](../docs/specs/PRD-V5-COMPLIANCE-CLOSURE.md)  
**DoD:** requisitos **obrigatórios** em CONFORME; DIFF-1 / DEL-3 / EVAL-7 permanecem NI (deploy opcional, não penaliza).

## Totais após fechamento

| Métrica | Antes | Depois |
|---|---|---|
| CONFORME (obrigatórios) | 44 | **62** |
| PARCIALMENTE CONFORME | 15 | **0** (obrigatórios) |
| NÃO IMPLEMENTADO obrigatório | 1 (AA-7) | **0** |
| NÃO VALIDADO obrigatório | 2 (TECH-6, EVAL-1) | **0** (EVAL-1 = suite scripted Anexo A em CI) |
| NI deploy (não penaliza) | 3 | **3** (DIFF-1, DEL-3, EVAL-7) |

Ambiguidades AMB-1..4: resolvidas por decisões congeladas no SPEC-mestre + README (confiança determinística; limiares duplicity/SLA; pixel-perfect Pencil fora do DoD; overdue = oferta).

## Matriz — gaps obrigatórios fechados

| ID | Status | Evidência |
|---|---|---|
| AA-2 | C | `formatCategoryLabel` Rede e VPN / E-mail; `consulta.test.ts` |
| AA-3 / OBJ-2 | C | `assertCreateDraftComplete`; confirm 4xx; tipo no `DraftConfirmCard`; HITL tests |
| AA-5 / HA-2 / HE-5 / OBJ-3 | C | `transfer.offer_unsure` + summary estruturado; critical/pedido preservados; overdue oferta |
| AA-7 | C | `detectOutOfItScope` + gate; API PRD closure |
| BUILD-7 / OBJ-4 / EVAL-3 | C | coluna `confidence`; `deriveConfidence`; EventChips “Grau de segurança” |
| CTX-2 | C | retry gateway; `fail_once` / `unavailable`; UX 503 |
| TECH-6 / HE-6 | C | teste reload Postgres em `api.integration.prd-v5-closure` |
| DEL-2 | C | README seed `v4` + limiares |
| AC-4 e2e | C | heading estável `Chamados da Ana` |
| OBJ-1 / EVAL-2 / EVAL-1 | C | suites scripted Anexo A + condução (domínio/API) como prova CI |
| TECH-4 / EVAL-4 | C | e2e cinco telas + loading/erro; Pencil pixel-perfect fora do DoD (AMB-3) |

## HR-13 (fechamento)

```text
pnpm --filter @nexo-assist/domain test          → 64 passed
LLM_PROVIDER=scripted pnpm --filter @nexo-assist/api test → 86 passed
pnpm --filter @nexo-assist/web test             → 16 passed
pnpm typecheck                                  → 6 tasks OK
pnpm --filter @nexo-assist/web test:e2e         → 8 passed
```

## Post-review fixes (senior-code-review-judge IMPORTANT)

- Offer-acceptance phrases removed from explicit transfer list; `unsure_accepted` Motivo reachable when prior agent offered analyst.
- `sim, por favor` transfers only with open offer (`hasOpenAnalystOffer`).
- Handoff summary aggregates prior events + conversation context (not only accept turn).
- AA-7 IT_GUARD expanded (sistema/app/fora do ar) to avoid finance soft-token false positives.
- `TICKET_FAULT=fail_once` no longer mutates `process.env` (per-call synthetic fail budget).
- Confidence column CHECK (`high|medium|low`); stall signals no longer include `out_of_it`.

## Fora do DoD de avaliação

- DIFF-1 / DEL-3 / EVAL-7 — deploy público opcional.
- Nightly Mastra + OpenRouter real.
- Comparação pixel-perfect Pencil sem artefato no repo.
