import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { ServiceUnavailableException } from '@nestjs/common';
import { closeDb, createDb } from '../src/db/client';
import { conversations, messages } from '../src/db/schema';
import { IDS } from '../src/db/seed';
import { AgentOrchestrator } from '../src/agent/orchestrator/agent.orchestrator';
import { PolicyEngine } from '../src/agent/policy/policy.engine';
import { ScriptedLlmProvider } from '../src/agent/providers/llm.provider';
import { TicketGateway } from '../src/tickets/ticket.gateway';
import { UsageGuard } from '../src/conversations/usage.guard';
import { setupIntegrationDb } from './helpers/db';
import { completeTurn } from './helpers/complete-turn';

describe('API integration — PRD v5 closure gaps', () => {
  beforeAll(async () => {
    await setupIntegrationDb();
  });

  afterAll(async () => {
    process.env.TICKET_FAULT = 'off';
    await closeDb();
  });

  it('redirects out-of-IT topics without preparing a draft (AA-7)', async () => {
    const db = createDb();
    const orchestrator = new AgentOrchestrator(
      TicketGateway.withDb(db),
      new PolicyEngine(),
      new UsageGuard(),
    );
    orchestrator.setProvider(new ScriptedLlmProvider());

    const [conv] = await db
      .insert(conversations)
      .values({ employeeId: IDS.ana, status: 'with_agent', employeeMessageCount: 0 })
      .returning();

    const turn = await completeTurn(orchestrator, {
      employeeId: IDS.ana,
      conversationId: conv!.id,
      content: 'Preciso tirar férias na próxima semana com o RH',
    });

    expect(turn.draft).toBeNull();
    expect(turn.agentMessage?.content).toMatch(/Recursos Humanos/i);
    expect(turn.events.some((event) => event.intent === 'out_of_it')).toBe(true);
    expect(turn.events.every((event) => event.tool !== 'prepare_draft')).toBe(true);
  });

  it('does not redirect VPN incidents as out-of-IT', async () => {
    const db = createDb();
    const orchestrator = new AgentOrchestrator(
      TicketGateway.withDb(db),
      new PolicyEngine(),
      new UsageGuard(),
    );
    orchestrator.setProvider(new ScriptedLlmProvider());

    const [conv] = await db
      .insert(conversations)
      .values({ employeeId: IDS.ana, status: 'with_agent', employeeMessageCount: 0 })
      .returning();

    const turn = await completeTurn(orchestrator, {
      employeeId: IDS.ana,
      conversationId: conv!.id,
      content: 'Meu notebook não conecta na VPN corporativa, erro 809.',
    });

    expect(turn.events.some((event) => event.intent === 'out_of_it')).toBe(false);
    expect(turn.agentMessage?.content.toLowerCase()).toMatch(/afetado|vpn|ajuda/);
  });

  it('persists confidence on execution events (BUILD-7)', async () => {
    const db = createDb();
    const orchestrator = new AgentOrchestrator(
      TicketGateway.withDb(db),
      new PolicyEngine(),
      new UsageGuard(),
    );
    orchestrator.setProvider(new ScriptedLlmProvider());

    const [conv] = await db
      .insert(conversations)
      .values({ employeeId: IDS.ana, status: 'with_agent', employeeMessageCount: 0 })
      .returning();

    const turn = await completeTurn(orchestrator, {
      employeeId: IDS.ana,
      conversationId: conv!.id,
      content: 'Qual o status dos meus chamados?',
    });

    expect(turn.events.length).toBeGreaterThan(0);
    expect(turn.events.every((event) => event.confidence != null)).toBe(true);
  });

  it('offers analyst on low-confidence stall and builds structured summary on accept (AA-5)', async () => {
    const db = createDb();
    const orchestrator = new AgentOrchestrator(
      TicketGateway.withDb(db),
      new PolicyEngine(),
      new UsageGuard(),
    );
    orchestrator.setProvider(new ScriptedLlmProvider());

    const [conv] = await db
      .insert(conversations)
      .values({ employeeId: IDS.ana, status: 'with_agent', employeeMessageCount: 0 })
      .returning();

    // Force a low-confidence incomplete create stall via free-text that scripts draft without impact.
    // First establish VPN context then answer with unknown impact path that stays ambiguous.
    await completeTurn(orchestrator, {
      employeeId: IDS.ana,
      conversationId: conv!.id,
      content: 'Meu notebook não conecta na VPN corporativa, erro 809 no Windows 11.',
    });
    const stall = await completeTurn(orchestrator, {
      employeeId: IDS.ana,
      conversationId: conv!.id,
      content: 'Não sei',
    });

    expect(stall.events.some((event) => event.rule === 'transfer.offer_unsure')).toBe(true);
    expect(stall.agentMessage?.content).toMatch(/chame um analista/i);

    await completeTurn(orchestrator, {
      employeeId: IDS.ana,
      conversationId: conv!.id,
      content: 'Sim, chame um analista',
    });
    const [after] = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, conv!.id));
    expect(after?.status).toBe('waiting_analyst');
    expect(after?.summary).toMatch(/baixa confiança/i);
    expect(after?.summary).toMatch(/VPN|809|Contexto:/i);
  });

  it('does not transfer on sim, por favor without an open offer', async () => {
    const db = createDb();
    const orchestrator = new AgentOrchestrator(
      TicketGateway.withDb(db),
      new PolicyEngine(),
      new UsageGuard(),
    );
    orchestrator.setProvider(new ScriptedLlmProvider());

    const [conv] = await db
      .insert(conversations)
      .values({ employeeId: IDS.ana, status: 'with_agent', employeeMessageCount: 0 })
      .returning();

    const turn = await completeTurn(orchestrator, {
      employeeId: IDS.ana,
      conversationId: conv!.id,
      content: 'sim, por favor',
    });
    const [after] = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, conv!.id));
    expect(after?.status).toBe('with_agent');
    expect(turn.events.some((event) => event.result === 'waiting_analyst')).toBe(false);
  });

  it('retries fail_once ticket fault then succeeds (CTX-2)', async () => {
    const db = createDb();
    const gateway = TicketGateway.withDb(db);
    process.env.TICKET_FAULT = 'fail_once';
    const rows = await gateway.listOwned(IDS.ana);
    expect(Array.isArray(rows)).toBe(true);
    // Affordance must not mutate global env (isolation across requests).
    expect(process.env.TICKET_FAULT).toBe('fail_once');
    process.env.TICKET_FAULT = 'off';
  });

  it('surfaces unavailable ticket fault after retries (CTX-2)', async () => {
    const db = createDb();
    const gateway = TicketGateway.withDb(db);
    process.env.TICKET_FAULT = 'unavailable';
    await expect(gateway.listOwned(IDS.ana)).rejects.toBeInstanceOf(ServiceUnavailableException);
    process.env.TICKET_FAULT = 'off';
  });

  it('reloads conversation messages from Postgres after re-read (TECH-6)', async () => {
    const db = createDb();
    const gateway = TicketGateway.withDb(db);
    const orchestrator = new AgentOrchestrator(gateway, new PolicyEngine(), new UsageGuard());
    orchestrator.setProvider(new ScriptedLlmProvider());

    const [conv] = await db
      .insert(conversations)
      .values({ employeeId: IDS.ana, status: 'with_agent', employeeMessageCount: 0 })
      .returning();

    await completeTurn(orchestrator, {
      employeeId: IDS.ana,
      conversationId: conv!.id,
      content: 'Qual o status dos meus chamados?',
    });

    // Simulate process restart: fresh DB client re-reads persisted rows.
    const reloadedDb = createDb();
    const [reloadedConversation] = await reloadedDb
      .select()
      .from(conversations)
      .where(eq(conversations.id, conv!.id));
    const reloadedMessages = await reloadedDb
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conv!.id));

    expect(reloadedConversation?.id).toBe(conv!.id);
    expect(reloadedMessages.length).toBeGreaterThanOrEqual(2);
    expect(reloadedMessages.some((row) => row.role === 'employee')).toBe(true);
    expect(reloadedMessages.some((row) => row.role === 'agent')).toBe(true);
  });
});
