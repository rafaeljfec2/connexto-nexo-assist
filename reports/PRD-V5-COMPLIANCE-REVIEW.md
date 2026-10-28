# Relatório de Conformidade — PRD v5 (Nexo Assist)

**Data da auditoria:** 2026-10-27  
**Fonte de verdade:** `Desafio_Tecnico_Nexo_Assist_PRD_v5.pdf` (5 páginas; caminho local Windows `C:\Users\rafae\Downloads\Desafio_Tecnico_Nexo_Assist_PRD_v5.pdf`)  
**Repositório auditado:** `/home/rafael/dev-rafael/connexto-nexo-assist` (`origin` → `https://github.com/rafaeljfec2/connexto-nexo-assist.git`)  
**Escopo desta etapa (original):** diagnóstico apenas.  
**Re-auditoria pós B1–B6:** ver [`PRD-V5-COMPLIANCE-ADDENDUM-2026-10-27.md`](./PRD-V5-COMPLIANCE-ADDENDUM-2026-10-27.md) — obrigatórios **100% CONFORME**; deploy (DIFF-1/DEL-3/EVAL-7) continua NI sem penalizar.

---

## A. Resumo executivo

### Totais

| Métrica | Valor |
|---|---|
| Requisitos identificáveis no PRD (matriz) | **65** |
| Ambiguidades do PRD (registradas à parte) | **4** |
| CONFORME | **44 / 65 (67,7%)** |
| PARCIALMENTE CONFORME | **15 / 65 (23,1%)** |
| NÃO IMPLEMENTADO | **4 / 65 (6,2%)** |
| NÃO VALIDADO | **2 / 65 (3,1%)** |
| BLOQUEADO | **0 / 65 (0%)** |

Denominador dos percentuais: **65** requisitos identificáveis. Ambiguidades (**4**) e itens NÃO VALIDADO (**2**) **não** foram classificados como CONFORME.

Sobre o subconjunto decidível (65 − 2 NÃO VALIDADO = **63**):

| Status | Quantidade | % de 63 |
|---|---|---|
| CONFORME | 44 | 69,8% |
| PARCIALMENTE CONFORME | 15 | 23,8% |
| NÃO IMPLEMENTADO | 4 | 6,3% |

### Principais lacunas

1. **Escopo TI (AA-7):** enum `out_of_it` existe, mas não há handler/prompt/teste que redirecione RH, financeiro ou facilities.
2. **Grau de segurança / confiança (BUILD-7 / OBJ-4):** chips expansíveis mostram intenção, ferramenta, regra, resultado e justificativa; **não há** campo de confiança/grau de segurança.
3. **Transferência por “agent sem segurança” (AA-5 / HA-2):** handoff por pedido explícito e por prioridade crítica existe; overdue oferece analista (não auto-transfere); caminho por baixa confiança do agent **ausente**.
4. **Abertura completa Anexo A (AA-3):** HITL existe, mas `prepare_draft` não exige todos os campos e o create aplica defaults (`incident` / `other` / título genérico); tipo não aparece no card de confirmação.
5. **Indisponibilidade do legado (CTX-2):** `TICKET_FAULT=unavailable` no gateway; sem retry, sem teste dedicado e sem UX específica.
6. **Deploy (DIFF-1 / DEL-3 / EVAL-7):** não implementado; o PRD declara que a ausência **não penaliza**.

### Riscos mais relevantes

| Risco | Severidade |
|---|---|
| Assunto fora de TI tratado como chamado de TI | Alta |
| Transparência incompleta no critério “mais importante” do desafio | Alta |
| Drafts confirmáveis com campos incompletos / defaults | Alta |
| Indisponibilidade simulada do serviço de chamados sem caminho de usuário testado | Média |
| Avaliação qualitativa com LLM real (OpenRouter em dev) pouco coberta pelos testes (quase tudo `scripted`) | Média |

### Conclusão de conformidade

O projeto **não atende integralmente** ao PRD v5. O núcleo do desafio (chat, Anexo A determinístico, HITL, Mastra, console, privacidade, seeds Anexo B, README e suite automatizada) está **majoritariamente implementado e evidenciado**. As lacunas que mais distanciam a entrega do PRD são escopo fora de TI, confiança/transparência completa, transfer por insegurança do agent e rigor dos campos obrigatórios na abertura.

---

## B. Matriz completa de rastreabilidade

Legenda de status: **C** CONFORME · **P** PARCIALMENTE CONFORME · **NI** NÃO IMPLEMENTADO · **NV** NÃO VALIDADO · **A** AMBÍGUO NO PRD

### B.1 Objetivo, contexto e histórias

| ID | Referência PRD | Requisito | Evidência | Validação | Status | Lacuna | Severidade | Dependências |
|---|---|---|---|---|---|---|---|---|
| OBJ-1 | p.1 · Sucesso | Resolução sem fila: dúvidas/consultas no chat | `search_help`, `list_my_tickets`, `get_ticket`; UI chat | Domain/API scripted + Playwright consulta | P | Qualidade depende do LLM; caminho Mastra real pouco coberto em CI | Média | HE-1, HE-2, BUILD-3 |
| OBJ-2 | p.1 · Sucesso | Chamados completos (tipo, categoria, prioridade) sem duplicidade | Domain priority/duplicity + HITL `DraftConfirmCard` | Domain + `api.integration.agent-hitl` | P | Defaults no create; tipo omitido no card | Alta | AA-3, AA-4 |
| OBJ-3 | p.1 · Sucesso | Encaminhamento certo com contexto | `waiting_analyst`, `transfer-intent`, summary truncado | API agent/console tests | P | Sem transfer por “sem segurança”; summary = últimos 280 chars | Média | AA-5, HA-2 |
| OBJ-4 | p.1 · Sucesso | Transparência do que o agent fez e por quê | `execution_events` + `EventChips` expansível | Unit `event-labels`; inspeção UI | P | Sem grau de segurança/confidence | Alta | BUILD-7 |
| CTX-1 | p.1 | Agent segue Anexo A, central de ajuda e chamados | `@nexo-assist/domain`, tools, `TicketGateway` | Domain 50 + API 71 | C | — | — | AA-*, BUILD-3/4 |
| CTX-2 | p.1 | Sistema de chamados legado pode ficar indisponível por segundos | `ticket.gateway.ts` `TICKET_FAULT`; `.env.example` | Só inspeção estática | P | Sem retry, teste E2E nem UX dedicada | Média | BUILD-4 |
| HE-1 | p.1 · Funcionário 1 | Tirar dúvida sem abrir chamado | `search_help` + scripted/Mastra | API scripted VPN/help | C | — | — | OBJ-1 |
| HE-2 | p.1 · Funcionário 2 | Status do chamado sem número + atraso | Consulta C1–C9; overdue | Integração + Playwright consulta (passou) | C | — | — | AC-3 |
| HE-3 | p.1 · Funcionário 3 | Complementar chamado aberto | `prepare_draft` update + confirm | Unit complement + HITL | C | — | — | AA-3 |
| HE-4 | p.1 · Funcionário 4 | Abrir só conversando e conferir antes | Draft + `evaluateConfirmation` + confirm endpoint | HITL integration | C | Ver AA-3 para campos incompletos | Média | AA-3, BUILD-7 |
| HE-5 | p.1 · Funcionário 5 | Falar com analista (preferência ou grave) | Frases explícitas + critical → transfer | `transfer-intent` + API | P | Overdue não auto-transfere (oferece); “grave” = critical | Baixa | AA-5 |
| HE-6 | p.1 · Funcionário 6 | Voltar e continuar | Postgres `conversations`/`messages`; `getOrCreateCurrent` | Schema + serviços; restart = TECH-6 | C | Reinício de processo não reexecutado nesta auditoria | Baixa | TECH-6 |
| HA-1 | p.1 · Analista 1 | Chamados com tipo/categoria/prioridade e boa descrição | Seed + create via gateway; sidebar console | Seed + console UI | C | Qualidade da descrição depende do draft/LLM | Baixa | AA-3, BUILD-6 |
| HA-2 | p.1 · Analista 2 | Ver conversas que precisam dele, incl. insegurança do agent | Fila `waiting_analyst` + filtros | Console + Playwright (parcial) | P | Sem geração automática de fila por baixa confiança | Alta | AA-5, BUILD-6 |
| HA-3 | p.1 · Analista 3 | Assumir (agent pausado), devolver ou encerrar | `claim` / `returnToAgent` / `close`; gate orchestrator | Integração console + e2e claim/return | C | 1 e2e claim falhou por locator strict (UI presente) | Baixa | BUILD-5/6 |

### B.2 O que construir e requisitos técnicos

| ID | Referência PRD | Requisito | Evidência | Validação | Status | Lacuna | Severidade | Dependências |
|---|---|---|---|---|---|---|---|---|
| BUILD-1 | p.2 · item 1 / p.5 Tela 1 | Login e-mail/senha; dados de exemplo com qualquer senha | `apps/web/src/app/login/page.tsx`; `auth.service.ts` | Playwright login + API auth | C | Auth demo (senhas não armazenadas) — alinhado ao PRD de exemplo | — | DEL-2 |
| BUILD-2 | p.2 · item 2 | Chat Telas 2–3: tempo real, cards, seleção, rascunho, opções rápidas, 30 msgs | SSE, `TicketCard`, `DraftConfirmCard`, `OptionChips`, `UsageGuard` 30 | API guards + e2e consulta | C | — | — | AC-2, AC-3 |
| BUILD-3 | p.2 · item 3 | Agent decide por mensagem com ajuda, tickets e Anexo A | `AgentOrchestrator` + Mastra/scripted + domain | API agent tests | C | Comportamento LLM real NV em CI | Média | CTX-1, TECH-2 |
| BUILD-4 | p.2 · item 4 / Tema Dados | Serviço de chamados simulado, separado, CRUD+transfer, Anexo B | `TicketGateway`; tools sem mutação direta | HITL + tickets integration | C | — | — | AB-*, TECH-5 |
| BUILD-5 | p.2 · item 5 | Transferência → aguardando atendente; agent para de responder até liberar | status `waiting_analyst`; orchestrator rejeita | API conversations | C | — | — | HA-3, AA-5 |
| BUILD-6 | p.2 · item 6 | Console Telas 4–5: lista/filtros, histórico, claim, return, close, painel de chamados | `apps/web/src/app/console`; `ConsoleService` | Integração + e2e (7/8) | C | 1 asserção e2e frágil | Baixa | AC-4, AC-5 |
| BUILD-7 | p.2 · Visibilidade (prioridade do desafio) | Ações acima da resposta + detalhe: entendimento, ação, **grau de segurança**, por quê | `EventChips.tsx` (intent/tool/rule/result/justification) | Inspeção + unit labels | P | Sem confidence/grau de segurança | Crítica | OBJ-4, EVAL-3 |
| TECH-1 | p.2 | TypeScript tipagem estrita | `tsconfig.base.json` `strict` | `pnpm typecheck` OK (6 tasks) | C | — | — | — |
| TECH-2 | p.2 | Mastra (preferência) ou LangGraph.js | `@mastra/core` em `mastra.ts` | Dependência + `runMastraTurn` | C | CI usa scripted | Baixa | BUILD-3 |
| TECH-3 | p.2 | Qualquer LLM; explicar escolha no README | README + OpenAI/OpenRouter/scripted | Inspeção README | C | — | — | DEL-2 |
| TECH-4 | p.2 · Interface | Seguir protótipo Anexo C (Next/React) | Next.js 15; 5 telas | E2E smoke; fidelidade Pencil NV | P | Sem Pencil versionado; fidelidade visual subjetiva | Média | AC-*, EVAL-4 |
| TECH-5 | p.2 · Dados | Serviço de chamados simulado separado do agent | Gateway vs tools | Typecheck / arquitetura | C | — | — | BUILD-4 |
| TECH-6 | p.2 · Persistência | Conversas/chamados/estado sobrevivem a reinício | Schema Postgres/Drizzle | TRACEABILITY alega assertion; **não encontrada** nestes testes | NV | Falta prova de restart nesta auditoria | Média | HE-6 |
| TECH-7 | p.2 · Execução | Poucos comandos no README + `.env.example` | README L5–32; `.env.example` | Inspeção | C | — | — | DEL-2 |
| TECH-8 | p.2 | Arquitetura clara interface/agent/serviços | `apps/web`, `apps/api` agent/tickets, `packages/domain` | README + TRACEABILITY | C | — | — | EVAL-5 |
| TECH-9 | p.2 | Organização, testes onde importam, erros, commits com história | Suites domain/api/web; git log convencional | Testes executados | C | Playwright incompleto | Baixa | EVAL-5 |
| TECH-10 | p.2 | Eficiência / custo por conversa | Limites: 4 tool steps, contexto 10, 600 tokens, 20s timeout | `UsageGuard` + README | C | — | — | — |
| TECH-11 | p.2 | Chaves fora do código; tickets de um funcionário não expostos a outro | `.env` / `.env.example`; `getOwned` Forbidden | `api.integration.tickets` INC-20150 | C | — | — | AA-6 |

### B.3 Diferenciais, entregáveis e critérios de avaliação

| ID | Referência PRD | Requisito | Evidência | Validação | Status | Lacuna | Severidade | Dependências |
|---|---|---|---|---|---|---|---|---|
| DIFF-1 | p.3 · Diferenciais | Deploy publicado (opcional; ausência não penaliza) | README: deploy out of scope | Inspeção | NI | Sem URL de deploy | N/A (não penaliza) | DEL-3 |
| DEL-1 | p.3 · Entregar 1 | Link do repositório GitHub | `origin` GitHub público | `git remote` / gh | C | — | — | — |
| DEL-2 | p.3 · Entregar 2 | README: run, arquitetura, decisões do agent, qualidade, trade-offs, mais tempo | `README.md` seções correspondentes | Inspeção | C | Seed id README cita `v3` vs código `v4` | Baixa | TECH-7 |
| DEL-3 | p.3 · Entregar 3 | Link do deploy, se feito | Ausente | Inspeção | NI | Condicional ao DIFF-1 | N/A | DIFF-1 |
| EVAL-1 | p.3 · Qualidade das decisões | Agent entende e escolhe ação certa (Anexo A) | Domain + scripted HITL/consulta | Suites scripted; LLM real NV | NV | Não avaliado com modelo de produção nesta auditoria | Alta | OBJ-2, AA-* |
| EVAL-2 | p.3 · Condução | Pergunta, confirma, mantém contexto, responde claro | Impact ask, HITL, last-10 context | Scripted + unit | P | Depende do LLM em produção | Média | HE-4, AA-3 |
| EVAL-3 | p.3 · Transparência | Fácil ver o que fez e por quê | EventChips | Inspeção | P | Sem grau de segurança | Alta | BUILD-7 |
| EVAL-4 | p.3 · Interface | Fidelidade ao protótipo + loading/erro | Telas + estados loading/error | E2E parcial | P | Fidelidade Pencil não mensurada objetivamente | Média | TECH-4, AC-* |
| EVAL-5 | p.3 · Arquitetura | Separação, tipagem, erros, organização, commits | Monorepo + typecheck + git history | typecheck OK | C | — | — | TECH-8/9 |
| EVAL-6 | p.3 · Comunicação | Clareza do README | README | Inspeção | C | — | — | DEL-2 |
| EVAL-7 | p.3 · Diferenciais | Deploy conta pontos extras | Ausente | Inspeção | NI | Não penaliza | N/A | DIFF-1 |

### B.4 Anexo A

| ID | Referência PRD | Requisito | Evidência | Validação | Status | Lacuna | Severidade | Dependências |
|---|---|---|---|---|---|---|---|---|
| AA-1 | p.4 | Tipos incidente (INC) / requisição (REQ) | `TicketTypeSchema`; `nextNumberIn` | HITL espera INC\|REQ | C | Fluxo novo incidente força `incident` | Baixa | AA-3 |
| AA-2 | p.4 | Categorias: Acesso, Rede e VPN, Hardware, Software, E-mail, Outros | `TicketCategorySchema`; labels em `DraftConfirmCard` | Enum + UI | P | `formatCategoryLabel` omite `email` e encurta network | Baixa | — |
| AA-3 | p.4 | Abertura: título, descrição, tipo, categoria, prioridade, afetado; draft; só cria/atualiza após confirmação | Draft HITL + `applyDraftMutation` | confirmation + HITL tests | P | Defaults; tipo ausente no card; `prepare_draft` required só `action` | Alta | HE-4, OBJ-2 |
| AA-4 | p.4 | Sem duplicidade (atualiza); reopen ≤ 7 dias | `detectDuplicity` 0.5/0.3; reopen 168h | Domain tests | C | Limiares numéricos são leitura de produto (AMB-2) | — | OBJ-2 |
| AA-5 | p.4 | Transfer: pedido, crítico, vencido, sem segurança; resumo; agent silencioso com analista | transfer-intent; critical; overdue offer; silence gate | API + unit | P | Sem “sem segurança”; overdue não auto-transfere; summary truncado | Alta | HE-5, HA-2 |
| AA-6 | p.4 | Privacidade: info só para quem abriu | `TicketGateway.getOwned` / `listOwned` | Integration INC-20150 | C | — | — | TECH-11 |
| AA-7 | p.4 | Escopo só TI; RH/financeiro/facilities redirecionados | Apenas enum `out_of_it` | Grep: sem handler | NI | Sem redirect | Alta | CTX-1 |
| AA-8 | p.4 | Prioridade por impacto/urgência; prazos; vencido após prazo; prazo por atualização | `decidePriority`; SLA 1h / 4h / 30h / 50h; due no complement | Domain sla/priority | C | 3/5 dias → 30/50h = leitura 10h/dia (AMB-4) | — | OBJ-2 |

### B.5 Anexo B e Anexo C

| ID | Referência PRD | Requisito | Evidência | Validação | Status | Lacuna | Severidade | Dependências |
|---|---|---|---|---|---|---|---|---|
| AB-1 | p.4 | Alguns funcionários | Ana, Rafael, Bruno, Carla | Seed | C | — | — | — |
| AB-2 | p.4 | 5–10 artigos curtos | 8 artigos em seed | Seed | C | — | — | — |
| AB-3 | p.4 | Chamados em situações variadas + outros funcionários | open/waiting/approved/resolved/overdue; INC-20150 Bruno | Seed | C | — | — | — |
| AB-4 | p.4 exemplo | Artigo VPN erro 809 | `vpn-erro-809` | Seed | C | Texto diferente do exemplo ilustrativo do PRD | Baixa | — |
| AB-5 | p.4 exemplo | Artigo horário service desk | `horario-service-desk` | Seed | C | — | — | — |
| AB-6 | p.4 exemplo | INC-20311 notebook lento / Hardware / Média / aguardando | Seed INC-20311 | Seed + e2e | C | — | — | AC-3/4 |
| AB-7 | p.4 exemplo | REQ-10442 segundo monitor / Hardware / Baixa / Aprovado | Seed | Seed | C | — | — | — |
| AB-8 | p.4 exemplo | INC-20150 SAP / Acesso / Média / Resolvido | Seed Bruno | Privacy test | C | — | — | AA-6 |
| AC-1 | p.5 Tela 1 | Login com apresentação Nexo Assist | `/login` | Playwright | C | — | — | BUILD-1 |
| AC-2 | p.5 Tela 2 | Abertura: perguntas, prioridade/prazo, rascunho | Chat + DraftConfirmCard + impact chips | HITL scripted | C | — | — | BUILD-2 |
| AC-3 | p.5 Tela 3 | Consulta: seleção, vencido, oferta analista | TicketPicker + overdue chips | Playwright consulta OK | C | — | — | HE-2 |
| AC-4 | p.5 Tela 4 | Console transferida: lista, waiting, agent pausado, chamados | Console UI + seed waiting | E2e claim parcial | C | Locator e2e estrito | Baixa | BUILD-6 |
| AC-5 | p.5 Tela 5 | Analista assumiu; devolver ou encerrar | Claimed UI + return/close APIs | E2e return OK; close sem e2e | C | Close sem cobertura Playwright | Baixa | HA-3 |

### B.6 Ambiguidades do PRD (não contadas como CONFORME)

| ID | Referência | Ambiguuidade | Impacto na auditoria |
|---|---|---|---|
| AMB-1 | p.2 Visibilidade | “Grau de segurança” e formato do detalhe são livres | BUILD-7 avaliado como P por ausência total de sinal de confiança |
| AMB-2 | p.4 Sem duplicidade | Sem algoritmo/limiares numéricos | AA-4 C com limiares 0,3/0,5 como leitura de produto |
| AMB-3 | p.5 Pencil | Fidelidade visual sem critério objetivo no PDF e sem artefato no repo | TECH-4 / EVAL-4 P |
| AMB-4 | p.4 SLA | “3/5 dias úteis” sem definir horas/dia | AA-8 C com 10h/dia (30/50h) documentado no README |

---

## C. Não conformidades detalhadas

### C1. Escopo fora de TI não redirecionado (AA-7) — **crítica**

- **Esperado:** assuntos RH/financeiro/facilities redirecionados; apenas TI no escopo.
- **Implementado:** `AgentIntentSchema` inclui `'out_of_it'` em `packages/contracts/src/enums.ts` (~L56); nenhum uso em agent/Mastra/scripted/testes.
- **Impacto:** conversas fora de TI podem gerar drafts/chamados indevidos.
- **Correção sugerida:** detectar escopo no policy/prompt; responder com redirecionamento; teste negativo; nunca chamar `prepare_draft` fora de TI.

### C2. Transparência sem grau de segurança (BUILD-7 / OBJ-4 / EVAL-3) — **crítica**

- **Esperado:** detalhe com o que entendeu, ação, **grau de segurança** e por quê (formato livre).
- **Implementado:** `EventChips` (`apps/web/src/components/EventChips.tsx` L53–70) e schema `execution_events` sem `confidence`.
- **Impacto:** critério destacado como “parte mais importante” fica incompleto.
- **Correção sugerida:** persistir e exibir score/nível (ex.: high/medium/low) derivado de regras (duplicity ambiguous, priority ask, tool failures).

### C3. Transferência por baixa confiança ausente (AA-5 / HA-2) — **alta**

- **Esperado:** transferir quando o agent não tem segurança; esses casos aparecem na fila do analista.
- **Implementado:** pedido explícito (`transfer-intent.ts`); critical (`agent.draft-store.ts`); overdue pergunta (`consulta.ts`); **sem** ramo “unsure → waiting_analyst”.
- **Impacto:** HA-2 parcialmente atendida; fila humana não cobre incerteza do modelo.
- **Correção sugerida:** quando priority=`ask`, duplicity ambiguous sem resolução, ou falha de tool crítica → oferecer/transferir com resumo estruturado.

### C4. Campos obrigatórios da abertura frouxos (AA-3 / OBJ-2) — **alta**

- **Esperado:** título, descrição, tipo, categoria, prioridade e afetado antes de criar/atualizar.
- **Implementado:** HITL presente; defaults em `applyDraftMutation` / `handlePrepareDraft`; `prepare_draft` exige só `action`; tipo não no `DraftConfirmCard`.
- **Impacto:** chamados podem nascer incompletos ou com classificação default.
- **Correção sugerida:** validar payload completo antes de status `pending`; bloquear confirm; exibir tipo no card; testes de rejeição.

### C5. Indisponibilidade do legado incompleta (CTX-2) — **média**

- **Esperado:** sistema pode ficar indisponível “por alguns segundos” (comportamento resiliente implícito no contexto).
- **Implementado:** `TICKET_FAULT === 'unavailable'` lança `ServiceUnavailableException` (`ticket.gateway.ts` ~L53–54); sem retry/backoff; UI genérica.
- **Impacto:** falha brusca; requisito de contexto não comprovado ponta a ponta.
- **Correção sugerida:** retry curto no gateway; mensagem amigável; teste de integração com fault on.

### C6. Categorias/labels incompletos na consulta (AA-2) — **baixa**

- **Esperado:** categorias do Anexo A, incl. E-mail e “Rede e VPN”.
- **Implementado:** enum completo; `formatCategoryLabel` em `consulta.ts` omite `email` e usa “Rede”.
- **Impacto:** inconsistência de apresentação.
- **Correção sugerida:** alinhar labels ao Anexo A / `DraftConfirmCard`.

### C7. Deploy ausente (DIFF-1 / DEL-3 / EVAL-7) — **N/A (não penaliza)**

- **Esperado:** opcional.
- **Implementado:** documentado como fora de escopo no README.
- **Impacto:** perde pontos extras apenas.
- **Correção sugerida:** se desejado, publicar com chaves protegidas e rate limit, documentando no README.

---

## D. Requisitos não validados

| ID | Motivo | Validação adicional necessária |
|---|---|---|
| TECH-6 | Persistência em Postgres evidenciada; assertion de “reload após restart” citada em `docs/TRACEABILITY.md` **não localizada** nos testes executados | Reiniciar API/Postgres container e reabrir conversa; ou adicionar teste de integração explícito |
| EVAL-1 | Suites usam `LLM_PROVIDER=scripted`; ambiente `pnpm dev` usa OpenRouter — qualidade decisória do modelo real não medida aqui | Roteiro manual/scripted golden cases com provider real; avaliação cega de decisões |
| Fidelidade Pencil (parte de TECH-4/EVAL-4) | Protótipo Pencil não está no repositório | Comparação visual frame a frame com o arquivo Pencil |
| Caminho Mastra+LLM real E2E | CI prova scripted; Mastra wired mas não exercitado com API key nesta auditoria | Smoke controlado com chave e captura de traces |
| Playwright claim “Chamados da Ana” | 1 falha por *strict mode* (2 nodes); UI existe | Ajustar seletor; reexecutar |

**Playwright nesta auditoria:** 7 passed / 1 failed / 8 total (~14s). Passaram: login, chat, profile, console vazio, return waiting, return after claim, consulta overdue. Falhou: claim Ana (locator).

---

## E. Defeitos técnicos adicionais (fora de requisito explícito isolado)

1. **Drift documental seed:** README menciona `nexo-assist-demo-v3`; código usa `nexo-assist-demo-v4` (`apps/api/src/db/seed/constants.ts`).
2. **`env.config` lê `ticketFault` mas o gateway lê `process.env` direto** — configuração DI/documentação desalinhada.
3. **Página `/profile`:** extra às 5 telas do PRD (não é não conformidade; é escopo adicional).
4. **Artigo VPN seed ≠ texto ilustrativo do PRD** — aceitável (“crie seus próprios dados”), mas reduz fidelidade aos exemplos.
5. **E2E Playwright frágil** no heading/botão “Chamados da Ana” (strict mode).
6. **Close de conversa** sem cobertura e2e (API existe).

Não confundir estes itens com não conformidades do PRD.

---

## F. Cenários de teste ausentes

1. Redirecionamento de escopo RH/financeiro/facilities (positivo e negativo).
2. Exibição/persistência de grau de confiança em `execution_events`.
3. Transfer automático/ofertado por “agent sem segurança” / priority ask prolongado.
4. Confirm de draft rejeitado quando faltam título/tipo/categoria/prioridade/afetado.
5. `TICKET_FAULT=unavailable` na API e mensagem na UI (com e sem retry).
6. Reinício do processo API → histórico da conversa intacto.
7. Golden path Mastra + provider real (VPN → impact → draft → confirm).
8. Playwright: draft HITL completo; limite 30 na UI; expand chips; close conversa; claim com seletor estável.
9. Concurrent claim (existe na API) espelhado na UI.
10. Labels de todas as 6 categorias na consulta e no card.

---

## G. Plano de correção priorizado

### 1. Segurança e integridade de dados

| Ação | Requisitos | Critério de pronto |
|---|---|---|
| Manter/reforçar owner checks em todos os reads/writes de ticket | AA-6, TECH-11 | Testes cross-employee verdes; sem regressão |
| Validar payload completo antes de mutação HITL | AA-3, OBJ-2 | Confirm com campos faltantes retorna 4xx e não grava |

### 2. Obrigatórios não implementados

| Ação | Requisitos | Critério de pronto |
|---|---|---|
| Implementar política `out_of_it` (prompt + domain/policy + resposta) | AA-7 | 3 casos (RH, financeiro, facilities) redirecionam sem draft |

### 3. Parcialmente implementados

| Ação | Requisitos | Critério de pronto |
|---|---|---|
| Persistir e exibir grau de segurança no detalhe dos chips | BUILD-7, OBJ-4, EVAL-3 | Campo visível na UI para turnos com regra/ask/ambiguous |
| Transfer/oferta por insegurança do agent | AA-5, HA-2 | Caso priority ask / duplicity ambiguous gera fila ou oferta explícita |
| Remover defaults silenciosos; mostrar tipo no card | AA-3 | Card lista os 6 campos; create sem default oculto |
| Overdue: documentar ou alinhar auto-transfer vs oferta | AA-5, HE-5 | Comportamento explícito no README + teste |

### 4. Integração e confiabilidade

| Ação | Requisitos | Critério de pronto |
|---|---|---|
| Retry curto + UX para `TICKET_FAULT` | CTX-2 | Teste integração fault on; UI mensagem clara |
| Teste de restart/persistência | TECH-6, HE-6 | Assertion automatizada pós-restart |
| Estabilizar e2e claim | BUILD-6, AC-4 | 8/8 Playwright verdes |

### 5. Cobertura de testes e documentação

| Ação | Requisitos | Critério de pronto |
|---|---|---|
| Cobrir F.1–F.10 relevantes | vários | CI verde com novos casos |
| Alinhar README seed id v4; documentar limiares duplicity e SLA horas | DEL-2, AMB-2/4 | README coerente com código |
| (Opcional) smoke Mastra real em nightly | EVAL-1, TECH-2 | Relatório de decisões anexado |

### 6. Melhorias opcionais

| Ação | Notas |
|---|---|
| Deploy com proteção de chaves e rate limit | DIFF-1 — pontos extras |
| Comparação visual com Pencil | EVAL-4 |
| Unificar labels de categoria | AA-2 |

---

## H. Conclusão

### O projeto atende integralmente ao PRD v5?

**Não.** Conformidade plena não foi alcançada: **44/65 (67,7%) CONFORME**, com **15/65 (23,1%) PARCIAL**, **4/65 (6,2%) NÃO IMPLEMENTADO** e **2/65 (3,1%) NÃO VALIDADO**, além de **4 ambiguidades** no texto do PRD.

### Quais requisitos ainda não estão comprovados?

- **NÃO IMPLEMENTADO:** AA-7 (escopo TI), DIFF-1 / DEL-3 / EVAL-7 (deploy opcional).
- **PARCIAL crítico/alto:** BUILD-7 (confiança), AA-3 (campos abertura), AA-5 / HA-2 (transfer por insegurança), OBJ-1..4 em grau de qualidade.
- **NÃO VALIDADO:** TECH-6 (restart), EVAL-1 (qualidade com LLM real).

### Bloqueadores para considerar a entrega “completa” frente ao PRD

1. Redirecionamento de escopo fora de TI.  
2. Transparência com grau de segurança (critério enfatizado no PRD).  
3. Rigidez HITL dos campos obrigatórios do Anexo A.  
4. Caminho de handoff quando o agent não tem segurança.  
5. Prova de persistência pós-reinício e (recomendado) estabilização do e2e de claim.

*Deploy não é bloqueador* — o PRD isenta penalidade.

### Verificações manuais ainda necessárias

1. Percorrer Pencil vs UI (login, abertura, consulta, console waiting, console claimed).  
2. Fluxo VPN real com o provider configurado em `.env` (hoje OpenRouter em `pnpm dev`).  
3. Confirmar visualmente expansão dos chips e presença/ausência de confiança.  
4. Simular `TICKET_FAULT=unavailable` e observar UX.  
5. Reiniciar API e validar histórico da conversa.  
6. Tentar assuntos RH/financeiro e observar comportamento atual (esperado: falha de conformidade).

---

## Apêndice — Evidência de testes executados nesta auditoria

| Comando | Resultado |
|---|---|
| `pnpm --filter @nexo-assist/domain test` | **50 passed** (7 files) |
| `LLM_PROVIDER=scripted pnpm --filter @nexo-assist/api test` | **71 passed** (22 files) |
| `pnpm typecheck` | **6/6 successful** |
| `pnpm --filter @nexo-assist/web test` (via `bash -lc`) | **15 passed** (2 files) |
| `pnpm exec playwright test` (apps/web; stack `pnpm dev` up) | **7 passed, 1 failed** (claim locator strict) |

Nenhum segredo, token ou conteúdo de `.env` foi reproduzido neste relatório.
