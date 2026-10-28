import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { closeDb, createDb } from '../src/db/client';
import { conversations } from '../src/db/schema';
import { IDS } from '../src/db/seed';
import { AgentOrchestrator } from '../src/agent/agent.orchestrator';
import { PolicyEngine } from '../src/agent/policy.engine';
import { ScriptedLlmProvider } from '../src/agent/llm.provider';
import { TicketGateway } from '../src/tickets/ticket.gateway';
import { UsageGuard } from '../src/conversations/usage.guard';
import { setupIntegrationDb } from './helpers/db';
import { completeTurn } from './helpers/complete-turn';

describe('API integration — agent orchestration', () => {
  beforeAll(async () => {
    await setupIntegrationDb();
  });

  afterAll(async () => {
    await closeDb();
  });

  it('scripted agent can list tickets and expose overdue INC-20311', async () => {
    const db = createDb();
    const provider = new ScriptedLlmProvider();
    const orchestrator = new AgentOrchestrator(
      TicketGateway.withDb(db),
      new PolicyEngine(),
      new UsageGuard(),
    );
    orchestrator.setProvider(provider);
    const [conv] = await db
      .insert(conversations)
      .values({ employeeId: IDS.ana, status: 'with_agent', employeeMessageCount: 0 })
      .returning();

    const result = await completeTurn(orchestrator, {
      employeeId: IDS.ana,
      conversationId: conv!.id,
      content: 'Qual o status do meu chamado?',
    });
    expect(provider.callCount).toBeGreaterThan(0);
    expect(result.events.some((e) => e.tool === 'list_my_tickets')).toBe(true);
    expect(result.agentMessage?.content.toLowerCase()).toMatch(/chamados abertos/);
    expect(result.agentMessage?.content.toLowerCase()).toMatch(/sobre qual/);
  });

  it('consulta flow: status → open list → select INC-20311 inspect + SLA overdue', async () => {
    const db = createDb();
    const gateway = TicketGateway.withDb(db);
    const provider = new ScriptedLlmProvider();
    const orchestrator = new AgentOrchestrator(gateway, new PolicyEngine(), new UsageGuard());
    orchestrator.setProvider(provider);

    const [conv] = await db
      .insert(conversations)
      .values({ employeeId: IDS.ana, status: 'with_agent', employeeMessageCount: 0 })
      .returning();

    const listTurn = await completeTurn(orchestrator, {
      employeeId: IDS.ana,
      conversationId: conv!.id,
      content: 'Qual o status do meu chamado?',
    });
    expect(listTurn.events.some((e) => e.tool === 'list_my_tickets')).toBe(true);

    const owned = await gateway.listOwned(IDS.ana);
    const openNumbers = owned.filter((t) => t.status !== 'resolved').map((t) => t.number);
    expect(openNumbers).toEqual(expect.arrayContaining(['INC-20298', 'INC-20311', 'REQ-10442']));
    expect(openNumbers).not.toContain('INC-20400');
    expect(openNumbers).not.toContain('INC-19990');
    expect(openNumbers.length).toBeGreaterThanOrEqual(3);

    const selectTurn = await completeTurn(orchestrator, {
      employeeId: IDS.ana,
      conversationId: conv!.id,
      content: 'INC-20311 · Notebook lento após atualização do Windows',
    });

    expect(selectTurn.events.some((e) => e.tool === 'get_ticket' && e.result === 'INC-20311')).toBe(
      true,
    );
    expect(
      selectTurn.events.some((e) => e.rule === 'ticket.inspect' && e.result === 'INC-20311'),
    ).toBe(true);
    expect(
      selectTurn.events.some((e) => e.rule === 'sla.compute_due' && e.result === 'overdue'),
    ).toBe(true);
    expect(selectTurn.agentMessage?.content.toLowerCase()).toMatch(
      /sem atualização|chame um analista|prazo/,
    );
  });

  it('does not transfer on bare analista mention', async () => {
    const db = createDb();
    const provider = new ScriptedLlmProvider();
    const orchestrator = new AgentOrchestrator(
      TicketGateway.withDb(db),
      new PolicyEngine(),
      new UsageGuard(),
    );
    orchestrator.setProvider(provider);
    const [conv] = await db
      .insert(conversations)
      .values({ employeeId: IDS.ana, status: 'with_agent', employeeMessageCount: 0 })
      .returning();

    await completeTurn(orchestrator, {
      employeeId: IDS.ana,
      conversationId: conv!.id,
      content: 'O analista já viu meu chamado INC-20311?',
    });

    const [after] = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, conv!.id));
    expect(after?.status).toBe('with_agent');
  });

  it('transfers only on explicit analyst request', async () => {
    const db = createDb();
    const provider = new ScriptedLlmProvider();
    const orchestrator = new AgentOrchestrator(
      TicketGateway.withDb(db),
      new PolicyEngine(),
      new UsageGuard(),
    );
    orchestrator.setProvider(provider);
    const [conv] = await db
      .insert(conversations)
      .values({ employeeId: IDS.ana, status: 'with_agent', employeeMessageCount: 0 })
      .returning();

    await completeTurn(orchestrator, {
      employeeId: IDS.ana,
      conversationId: conv!.id,
      content: 'Quero falar com um analista',
    });

    const [after] = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, conv!.id));
    expect(after?.status).toBe('waiting_analyst');
  });

  it('stops before a fifth tool step', async () => {
    const db = createDb();
    const provider = new ScriptedLlmProvider();
    provider.forceToolLoop = true;
    const orchestrator = new AgentOrchestrator(
      TicketGateway.withDb(db),
      new PolicyEngine(),
      new UsageGuard(),
    );
    orchestrator.setProvider(provider);
    const [conv] = await db
      .insert(conversations)
      .values({ employeeId: IDS.ana, status: 'with_agent', employeeMessageCount: 0 })
      .returning();

    const result = await completeTurn(orchestrator, {
      employeeId: IDS.ana,
      conversationId: conv!.id,
      content: 'VPN erro 809',
    });

    const toolOks = result.events.filter(
      (event) => event.tool === 'search_help' && event.result === 'ok',
    );
    expect(toolOks.length).toBeLessThanOrEqual(4);
    expect(result.events.some((event) => event.rule === 'usage.max_tool_steps')).toBe(true);
  });
});
