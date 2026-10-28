# SPEC — Analyst Console (Atendente)

Frozen UI and behavior obligations for the Pencil “Atendente — Conversas” screen.

## Layout (L1–L4)

| ID | Obligation |
|---|---|
| L1 | Four panes: rail (~64px), queue list (~380px), conversation (flex), ticket sidebar (~340px, visible from `lg`) |
| L2 | Queue filters: Todas, Para você, Com o agent, Minhas, with counts |
| L3 | Selected waiting conversation shows takeover bar: Devolver ao agent + Assumir atendimento + locked composer |
| L4 | Ticket sidebar splits “Desta conversa” vs “Outros chamados” with open/closed counts |

## Conversation thread (T1–T3)

| ID | Obligation |
|---|---|
| T1 | Employee bubbles left/white; agent/analyst bubbles right/tint |
| T2 | System messages render as centered transfer dividers |
| T3 | Day pill “Hoje” appears above the thread |

## Actions (A1–A4)

| ID | Obligation |
|---|---|
| A1 | Claim only succeeds when status is `waiting_analyst` and `analystId` is null (exclusive) |
| A2 | Return from `waiting_analyst` sets `with_agent` without requiring a prior claim; conditional UPDATE must succeed before inserting the system message |
| A3 | Return/close from `with_analyst` require the assigned analyst; close also resolves the featured linked ticket when one is identified |
| A4 | Analyst messages allowed only while `with_analyst` for the assigned analyst |

## Seed anchors

| Fixture | Purpose |
|---|---|
| Ana Souza · `waiting_analyst` · INC-20311 | Pencil featured queue row + sidebar |
| Carla Nunes · `waiting_analyst` | Concurrent claim race |
| Rafael Lima | Analyst identity |
