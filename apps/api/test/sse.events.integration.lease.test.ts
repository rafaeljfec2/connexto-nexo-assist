import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { closeDb, createDb } from '../src/db/client';
import { conversationEvents, conversations, messages } from '../src/db/schema';
import { IDS } from '../src/db/seed';
import { AgentOrchestrator } from '../src/agent/orchestrator/agent.orchestrator';
import { PolicyEngine } from '../src/agent/policy/policy.engine';
import { ScriptedLlmProvider } from '../src/agent/providers/llm.provider';
import { TicketGateway } from '../src/tickets/ticket.gateway';
import { UsageGuard } from '../src/conversations/usage.guard';
import { ConsoleService } from '../src/console/console.service';
import { ConversationEventsService } from '../src/events/conversation-events.service';
import { setupIntegrationDb } from './helpers/db';

describe('SSE / conversation events — leases and orchestrator', () => {
  beforeAll(async () => {
    await setupIntegrationDb();
  });

  afterAll(async () => {
    await closeDb();
  });

  it('rejects concurrent accept with 409 while lease is active', async () => {
    const db = createDb();
    const events = new ConversationEventsService();
    const orchestrator = new AgentOrchestrator(
      TicketGateway.withDb(db),
      new PolicyEngine(),
      new UsageGuard(),
      events,
    );
    orchestrator.setProvider(new ScriptedLlmProvider());
    const [conv] = await db
      .insert(conversations)
      .values({
        employeeId: IDS.ana,
        status: 'with_agent',
        employeeMessageCount: 0,
        busyUntil: new Date(Date.now() + 60_000),
        activeExecutionId: randomUUID(),
      })
      .returning();

    await expect(
      orchestrator.handleEmployeeMessage({
        employeeId: IDS.ana,
        conversationId: conv!.id,
        content: 'segunda mensagem',
      }),
    ).rejects.toThrow(/execução/i);
  });

  it('idempotent clientMessageId retry does not create a second message or turn', async () => {
    const db = createDb();
    const events = new ConversationEventsService();
    const orchestrator = new AgentOrchestrator(
      TicketGateway.withDb(db),
      new PolicyEngine(),
      new UsageGuard(),
      events,
    );
    orchestrator.setProvider(new ScriptedLlmProvider());
    const [conv] = await db
      .insert(conversations)
      .values({ employeeId: IDS.ana, status: 'with_agent', employeeMessageCount: 0 })
      .returning();

    const clientMessageId = randomUUID();
    const first = await orchestrator.handleEmployeeMessage({
      employeeId: IDS.ana,
      conversationId: conv!.id,
      content: 'VPN erro 809',
      clientMessageId,
    });
    const second = await orchestrator.handleEmployeeMessage({
      employeeId: IDS.ana,
      conversationId: conv!.id,
      content: 'VPN erro 809',
      clientMessageId,
    });

    expect(second.employeeMessage.id).toBe(first.employeeMessage.id);
    expect(second.executionId).toBe(first.executionId);

    const employeeMsgs = await db
      .select()
      .from(messages)
      .where(
        and(eq(messages.conversationId, conv!.id), eq(messages.role, 'employee')),
      );
    expect(employeeMsgs).toHaveLength(1);

    if (first.executionId) {
      await orchestrator.awaitExecution(first.executionId);
    }
  });

  it('zombie post-expiry cannot persist; new execution wins via fencing', async () => {
    const db = createDb();
    const events = new ConversationEventsService();
    const orchestrator = new AgentOrchestrator(
      TicketGateway.withDb(db),
      new PolicyEngine(),
      new UsageGuard(),
      events,
    );
    orchestrator.setProvider(new ScriptedLlmProvider());
    const zombieExec = randomUUID();
    const [conv] = await db
      .insert(conversations)
      .values({
        employeeId: IDS.ana,
        status: 'with_agent',
        employeeMessageCount: 0,
        busyUntil: new Date(Date.now() - 1_000),
        activeExecutionId: zombieExec,
      })
      .returning();

    const accept = await orchestrator.handleEmployeeMessage({
      employeeId: IDS.ana,
      conversationId: conv!.id,
      content: 'Qual o status do meu chamado?',
    });
    expect(accept.executionId).toBeTruthy();
    expect(accept.executionId).not.toBe(zombieExec);

    const discarded = await orchestrator.persistAgentOutcome({
      conversationId: conv!.id,
      executionId: zombieExec,
      agentContent: 'resposta zumbi',
      events: [],
      draft: null,
      status: 'with_agent',
      summary: null,
    });
    expect(discarded).toBeNull();

    const zombieMsgs = await db
      .select()
      .from(messages)
      .where(
        and(eq(messages.conversationId, conv!.id), eq(messages.role, 'agent')),
      );
    expect(zombieMsgs.some((m) => m.content === 'resposta zumbi')).toBe(false);

    if (accept.executionId) {
      await orchestrator.awaitExecution(accept.executionId);
    }

    const [after] = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, conv!.id));
    expect(after?.activeExecutionId).toBeNull();

    const incomplete = await db
      .select()
      .from(conversationEvents)
      .where(
        and(
          eq(conversationEvents.conversationId, conv!.id),
          eq(conversationEvents.type, 'agent.incomplete'),
        ),
      );
    expect(incomplete.some((e) => e.payload['executionId'] === zombieExec)).toBe(true);
  });

  it('claim clears lease fencing columns', async () => {
    const db = createDb();
    const events = new ConversationEventsService();
    const consoleService = new ConsoleService(events);
    const [conv] = await db
      .insert(conversations)
      .values({
        employeeId: IDS.ana,
        status: 'waiting_analyst',
        employeeMessageCount: 1,
        busyUntil: new Date(Date.now() + 60_000),
        activeExecutionId: randomUUID(),
      })
      .returning();

    await consoleService.claim(conv!.id, IDS.rafael);
    const [after] = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, conv!.id));
    expect(after?.status).toBe('with_analyst');
    expect(after?.busyUntil).toBeNull();
    expect(after?.activeExecutionId).toBeNull();
  });
});
