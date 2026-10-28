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
import { ConversationsService } from '../src/conversations/conversations.service';
import { setupIntegrationDb } from './helpers/db';
import { completeTurn } from './helpers/complete-turn';

describe('API integration — conversation lifecycle', () => {
  beforeAll(async () => {
    await setupIntegrationDb();
  });

  afterAll(async () => {
    await closeDb();
  });

  it('does not auto-reply when conversation waits for analyst', async () => {
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
      .values({
        employeeId: IDS.ana,
        status: 'waiting_analyst',
        employeeMessageCount: 1,
      })
      .returning();
    await expect(
      orchestrator.handleEmployeeMessage({
        employeeId: IDS.ana,
        conversationId: conv!.id,
        content: 'oi',
      }),
    ).rejects.toThrow(/pausado/i);
    expect(provider.callCount).toBe(0);
  });

  it('stores employee replies during with_analyst without calling the LLM', async () => {
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
      .values({
        employeeId: IDS.ana,
        status: 'with_analyst',
        analystId: IDS.rafael,
        employeeMessageCount: 2,
      })
      .returning();

    const result = await completeTurn(orchestrator, {
      employeeId: IDS.ana,
      conversationId: conv!.id,
      content: 'Recebi, obrigada',
    });

    expect(result.employeeMessage.content).toBe('Recebi, obrigada');
    expect(result.executionId).toBeNull();
    expect(result.agentMessage).toBeNull();
    expect(result.events).toHaveLength(0);
    expect(result.employeeMessageCount).toBe(3);
    expect(provider.callCount).toBe(0);

    const [updated] = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, conv!.id));
    expect(updated?.status).toBe('with_analyst');
    expect(updated?.employeeMessageCount).toBe(3);
  });

  it('does not create a fresh with_agent conversation while paused', async () => {
    const db = createDb();
    const provider = new ScriptedLlmProvider();
    const orchestrator = new AgentOrchestrator(
      TicketGateway.withDb(db),
      new PolicyEngine(),
      new UsageGuard(),
    );
    orchestrator.setProvider(provider);
    const service = new ConversationsService(orchestrator, new UsageGuard());

    const [paused] = await db
      .insert(conversations)
      .values({
        employeeId: IDS.bruno,
        status: 'waiting_analyst',
        employeeMessageCount: 12,
        summary: 'Paused for analyst',
      })
      .returning();

    const current = await service.getOrCreateCurrent(IDS.bruno);
    expect(current.conversation?.id).toBe(paused!.id);
    expect(current.conversation?.status).toBe('waiting_analyst');
    expect(current.conversation?.employeeMessageCount).toBe(12);

    await expect(service.sendMessage(IDS.bruno, 'ainda quero ajuda')).rejects.toThrow(
      /pausado/i,
    );
    expect(provider.callCount).toBe(0);

    const openRows = await db
      .select()
      .from(conversations)
      .where(eq(conversations.employeeId, IDS.bruno));
    expect(openRows.some((row) => row.id === paused!.id && row.status === 'waiting_analyst')).toBe(
      true,
    );
    const withAgentAfterPause = openRows.filter(
      (row) => row.status === 'with_agent' && row.createdAt.getTime() >= paused!.createdAt.getTime(),
    );
    expect(withAgentAfterPause).toHaveLength(0);
  });
});
