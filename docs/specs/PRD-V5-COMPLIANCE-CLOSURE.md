# SPEC — PRD v5 Compliance Closure

## Intent

Close all **mandatory** PRD v5 obligations to CONFORME with automated evidence. Deploy triad (DIFF-1, DEL-3, EVAL-7) stays out of evaluation DoD.

## Frozen product decisions

1. Overdue → **offer** analyst (not auto-transfer).
2. Agent insecurity (`confidence=low` + stall) → **explicit offer** (chip + handoff phrase).
3. Explicit ask and `critical` priority → direct transfer (preserve).
4. Confidence = `high | medium | low` deterministic rules (not LLM score).
5. Out-of-IT = domain heuristic + early turn gate.
6. Create draft: no silent defaults; confirm rejects incomplete payload.
7. Deploy remains out of DoD.

## Boundaries (gate order)

| ID | Gap | Acceptance |
|---|---|---|
| B1 | AA-2, AC-4 e2e, README | Labels Rede e VPN / E-mail; stable heading selector; seed v4 |
| B2 | AA-3, OBJ-2 | Incomplete create not pending; confirm 4xx; type on card |
| B3 | AA-7 | RH/finance/facilities redirect; VPN not redirected |
| B4 | BUILD-7, OBJ-4, EVAL-3 | Events persist confidence; UI shows high/medium/low |
| B5 | AA-5, HA-2 | Low-confidence stall offers analyst; structured handoff summary |
| B6 | CTX-2, TECH-6 | Fault retry + UX; conversation reload assertion; TRACEABILITY |

## Evidence (master)

| Field | Content |
|---|---|
| Claim | All mandatory PRD v5 requirements are CONFORME with automated evidence |
| Success type | `test` (+ `command` typecheck) |
| Evidence path | Updated compliance matrix + domain/API/web/Playwright + TRACEABILITY |
| Budget | One new/changed test per critical gap; full HR-13 on loop close |
| Affordance | `TICKET_FAULT`, `LLM_PROVIDER=scripted` |
