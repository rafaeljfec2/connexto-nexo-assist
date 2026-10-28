import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { closeDb, createDb } from '../src/db/client';
import { conversations, drafts, messages, tickets } from '../src/db/schema';
import { IDS } from '../src/db/seed';
import { AgentOrchestrator } from '../src/agent/agent.orchestrator';
import { PolicyEngine } from '../src/agent/policy.engine';
import { ScriptedLlmProvider } from '../src/agent/llm.provider';
import { TicketGateway } from '../src/tickets/ticket.gateway';
import { UsageGuard } from '../src/conversations/usage.guard';
import { setupIntegrationDb } from './helpers/db';
import { completeTurn } from './helpers/complete-turn';

describe('API integration — agent HITL drafts', () => {
  beforeAll(async () => {
    await setupIntegrationDb();
  });

  afterAll(async () => {
    await closeDb();
  });

  it('scripted VPN 809 flow asks impact then prepares HITL draft', async () => {
    const db = createDb();
    const gateway = TicketGateway.withDb(db);
    const provider = new ScriptedLlmProvider();
    const orchestrator = new AgentOrchestrator(gateway, new PolicyEngine(), new UsageGuard());
    orchestrator.setProvider(provider);

    const [conv] = await db
      .insert(conversations)
      .values({ employeeId: IDS.ana, status: 'with_agent', employeeMessageCount: 0 })
      .returning();

    const intake = await completeTurn(orchestrator, {
      employeeId: IDS.ana,
      conversationId: conv!.id,
      content: 'Meu notebook não conecta na VPN corporativa, erro 809 no Windows 11.',
    });

    expect(intake.events.some((event) => event.tool === 'list_my_tickets' && event.result === 'ok')).toBe(
      true,
    );
    expect(intake.events.some((event) => event.tool === 'search_help' && event.result === 'ok')).toBe(
      true,
    );
    expect(intake.agentMessage?.content.toLowerCase()).toContain('quem está sendo afetado');
    expect(intake.draft).toBeNull();

    const draftTurn = await completeTurn(orchestrator, {
      employeeId: IDS.ana,
      conversationId: conv!.id,
      content: 'Só eu. Tenho reunião importante com o cliente às 14h.',
    });

    expect(draftTurn.events.some((event) => event.tool === 'prepare_draft')).toBe(true);
    expect(draftTurn.events.some((event) => event.rule?.includes('priority'))).toBe(true);
    expect(draftTurn.events.some((event) => event.rule === 'sla.compute_due')).toBe(true);
    expect(draftTurn.draft?.status).toBe('pending');
    expect(draftTurn.draft?.payload['affectedScope']).toBe('self');
    expect(draftTurn.draft?.payload['sameDayCommitment']).toBe(true);
    expect(draftTurn.draft?.payload['priority']).toBe('high');
    expect(typeof draftTurn.draft?.payload['dueAt']).toBe('string');

    const beforeCount = (await db.select().from(tickets)).length;
    const confirmed = await orchestrator.confirmDraft({
      employeeId: IDS.ana,
      conversationId: conv!.id,
      draftId: draftTurn.draft!.id,
      version: draftTurn.draft!.version,
      confirm: true,
    });
    expect(confirmed.ok).toBe(true);
    expect(confirmed.mutation).toBeTruthy();
    const afterCount = (await db.select().from(tickets)).length;
    expect(afterCount).toBe(beforeCount + 1);

    const ticketNumber = String(confirmed.mutation?.['number'] ?? '');
    expect(ticketNumber).toMatch(/^(INC|REQ)-\d+$/);
    const agentMessages = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conv!.id));
    const feedback = agentMessages.filter((row) => row.role === 'agent').at(-1);
    expect(feedback?.content).toContain(`Criei o chamado ${ticketNumber}`);
  });

  it('confirming the same draft twice does not create a second ticket', async () => {
    const db = createDb();
    const gateway = TicketGateway.withDb(db);
    const orchestrator = new AgentOrchestrator(gateway, new PolicyEngine(), new UsageGuard());
    orchestrator.setProvider(new ScriptedLlmProvider());

    const [conv] = await db
      .insert(conversations)
      .values({ employeeId: IDS.ana, status: 'with_agent', employeeMessageCount: 0 })
      .returning();

    const [draft] = await db
      .insert(drafts)
      .values({
        conversationId: conv!.id,
        version: 1,
        action: 'create',
        payload: {
          action: 'create',
          title: 'Draft confirm retry',
          description: 'same draft twice',
          category: 'software',
          type: 'incident',
          affectedScope: 'self',
          workStopped: false,
          sameDayCommitment: false,
          hasAlternative: true,
        },
        status: 'pending',
      })
      .returning();

    const first = await orchestrator.confirmDraft({
      employeeId: IDS.ana,
      conversationId: conv!.id,
      draftId: draft!.id,
      version: 1,
      confirm: true,
    });
    const second = await orchestrator.confirmDraft({
      employeeId: IDS.ana,
      conversationId: conv!.id,
      draftId: draft!.id,
      version: 1,
      confirm: true,
    });

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(second.mutation).toEqual(first.mutation);

    const created = await db.select().from(tickets);
    const matches = created.filter((ticket) => ticket.title === 'Draft confirm retry');
    expect(matches).toHaveLength(1);
  });
});
