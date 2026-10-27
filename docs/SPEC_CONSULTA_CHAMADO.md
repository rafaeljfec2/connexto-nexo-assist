# SPEC — Screen 2: Consulta de chamado

Frozen product obligations for the ticket status consultation flow (Anexo C screen 2). These are business rules, not cosmetic layout.

| ID | Rule | Observable acceptance |
|---|---|---|
| C1 | **Consulta intent** — Asking for ticket status lists only open tickets of the authenticated employee. Never another employee's. | After “Qual o status do meu chamado?”, picker shows only owned non-resolved tickets. |
| C2 | **Ambiguity** — With more than one open ticket, the agent asks which one and presents a selectable list. It must not invent a ticket. | Agent reply asks “Sobre qual…?”; list comes from `list_my_tickets`. |
| C3 | **Compact list** — Each item shows number, short title, colored status, and a short date (opened or last update). Prototype statuses: Aguardando analista (orange), Em andamento (blue), Aprovado (green). | Compact cards render those fields. |
| C4 | **Selection = agent turn** — Choosing a ticket sends the selection, inspects that ticket, and computes the deadline. Second-turn chips: `consultou o INC-XXXX` and `calculou o prazo`. | `POST` message with number/title; events `ticket.inspect` / `get_ticket` + `sla.compute_due`. |
| C5 | **Detail card** — Title, description, category, priority, opened at, relative last update (`há N dias`). If `dueAt < now` and status ≠ resolved: mark `prazo vencido` and explain delay using Annex A (medium = 3 business days). | Detail card after inspect turn; overdue suffix when applicable. |
| C6 | **Post-overdue actions** — Only when overdue: `Falar com um analista` (transfer request), `Adicionar informação` (start complement), `Não, obrigado` (clear selection, no mutation). | Actions send messages or clear; no silent local-only mutations. |
| C7 | **Transparency** — Chips above the agent reply, current turn only, expandable with real intent/tool/rule/result. | `EventChips` from that turn's `execution_events`. |
| C8 | **Limit** — Employee message counter `n/30`; 31st rejected by backend. | Counter in UI; API enforces `UsageGuard`. |
| C9 | **Agent state** — `Assistente online` while conversation is with the agent; otherwise `Agente pausado`. | Status pill reflects conversation status. |

## Structured events (C4 / C7)

| Event | Meaning | Chip label |
|---|---|---|
| `tool=list_my_tickets` | Listed owned tickets | consultou seus chamados |
| `rule=ticket.inspect` or `tool=get_ticket` | Inspected one ticket; `result` carries the number | consultou o INC-XXXX |
| `rule=sla.compute_due` | Due / overdue evaluated for the selected ticket | calculou o prazo |

## Out of scope

- Novo chamado (VPN / HITL draft) flow
- Analyst console claim/return/close
