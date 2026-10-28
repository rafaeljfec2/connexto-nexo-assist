# Threat model — Nexo Assist

Security premise: **the model can be manipulated**. Critical controls therefore live in the application (authz, tool allow-list, HITL, owner checks), not in prompt wording alone.

## Assets

| Asset | Why it matters |
|---|---|
| Ticket data (title, description, history) | Confidentiality between employees |
| Draft → ticket mutations | Integrity of the service desk |
| Session cookie | Impersonation |
| LLM spend / API capacity | Availability and cost abuse |
| System / agent instructions | Policy bypass via prompt injection |

## Actors

| Actor | Capability |
|---|---|
| Employee (authenticated) | Own tickets, chat, drafts |
| Analyst (authenticated) | Console claim / return / close |
| Anonymous / scripted client | Login attempts, unauthenticated probes |
| Malicious content in help articles or ticket fields | Indirect prompt injection into the model |
| Compromised or jailbroken model behavior | Unexpected tool calls or misleading replies |

## Risks and controls

| ID | Risk | Control in this codebase | Evidence |
|---|---|---|---|
| T1 | Prompt injection via user message, help body, or ticket text | Instructions treat content as data; free text from tools wrapped in `[untrusted_data]` for the LLM only; mutations are never model tools | `mastra.ts` instructions; `tools/untrusted-data.ts`; ADR 0003 |
| T2 | Model invents unauthorized writes | Tool allow-list (`search_help`, `list_my_tickets`, `get_ticket`, `prepare_draft` only); create/update/reopen/transfer only via `TicketGateway` after HITL | `agent.tools.ts`; `TicketGateway`; draft confirm |
| T3 | Cross-employee ticket read | Gateway and tools scope by authenticated `employeeId` | `findOwnedByNumberOrId`; integration test INC-20150 |
| T4 | Role confusion (employee ↔ analyst) | `EmployeeGuard` / `AnalystGuard` on controllers | Auth integration tests |
| T5 | Incomplete / silent ticket create | Domain `assertCreateDraftComplete`; confirm rejects incomplete drafts | Domain + HITL API tests |
| T6 | Login / LLM DoS on demo auth | Helmet; `trust proxy`; Throttler (login 10/min, messages 30/min, global 120/min) | `main.ts`; `app.module.ts`; controllers |
| T7 | Session theft via XSS | `httpOnly` + `SameSite=Lax` cookie; no ticket authority in `localStorage` | `auth.controller.ts`; README |
| T8 | Out-of-scope social engineering (RH/finance) | Deterministic out-of-IT gate before LLM | `detectOutOfItScope`; PRD closure tests |
| T9 | Over-trusting model for Annex A | Priority/SLA/duplicity in `@nexo-assist/domain` | Domain vitest suite |

## What we deliberately do not claim

- Prompt wrappers stop all jailbreaks (they reduce influence; architecture contains blast radius).
- Demo auth (any non-empty password for seeded emails) is production-grade — it is evaluation-only.
- Full adversarial red-team coverage of every injection string — we cover privacy, role guards, HITL, untrusted wrapping, and closure scenarios; expanding adversarial corpora is future work.

## Related docs

- [`../adr/0003-hitl-draft-gateway.md`](../adr/0003-hitl-draft-gateway.md)
- [`../agent.md`](../agent.md)
- Root README — Security by Design
