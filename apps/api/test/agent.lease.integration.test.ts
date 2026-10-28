import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { closeDb, createDb } from '../src/db/client';
import { conversationEvents, conversations, messages } from '../src/db/schema';
import { IDS } from '../src/db/seed';
import { AgentOrchestrator } from '../src/agent/agent.orchestrator';
import { PolicyEngine } from '../src/agent/policy.engine';
import type { LlmProvider, LlmStepResult } from '../src/agent/llm.provider';
import { TicketGateway } from '../src/tickets/ticket.gateway';
import { UsageGuard } from '../src/conversations/usage.guard';
import { ConversationEventsService } from '../src/events/conversation-events.service';
import { setupIntegrationDb } from './helpers/db';

class SlowThenReplyProvider implements LlmProvider {
  readonly name = 'slow-test';
  private readonly gate: Promise<void>;
  private resolveGate!: () => void;

  constructor() {
    this.gate = new Promise((resolve) => {
      this.resolveGate = resolve;
    });
  }

  release(): void {
    this.resolveGate();
  }

  async complete(): Promise<LlmStepResult> {
    await this.gate;
    return {
      content: 'Resposta após lease wall-clock.',
      toolCalls: [],
    };
  }
}

describe('Agent lease F5 — incomplete vs pendingRuns', () => {
  beforeAll(async () => {
    await setupIntegrationDb();
  });

  afterAll(async () => {
    await closeDb();
  });

  it('does not clear lease or emit incomplete while execution is still pending', async () => {
    const db = createDb();
    const events = new ConversationEventsService();
    const orchestrator = new AgentOrchestrator(
      TicketGateway.withDb(db),
      new PolicyEngine(),
      new UsageGuard(),
      events,
    );
    const provider = new SlowThenReplyProvider();
    orchestrator.setProvider(provider);

    const [conv] = await db
      .insert(conversations)
      .values({ employeeId: IDS.ana, status: 'with_agent', employeeMessageCount: 0 })
      .returning();

    const accepted = await orchestrator.handleEmployeeMessage({
      employeeId: IDS.ana,
      conversationId: conv!.id,
      content: 'preciso de ajuda',
    });
    expect(accepted.executionId).toBeTruthy();
    const executionId = accepted.executionId!;
    expect(orchestrator.hasPendingExecution(executionId)).toBe(true);

    await db
      .update(conversations)
      .set({ busyUntil: new Date(Date.now() - 1_000) })
      .where(eq(conversations.id, conv!.id));

    await orchestrator.signalIncompleteForTests(conv!.id, executionId);

    const [stillBusy] = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, conv!.id));
    expect(stillBusy?.activeExecutionId).toBe(executionId);
    expect(stillBusy?.busyUntil).not.toBeNull();

    const incomplete = await db
      .select()
      .from(conversationEvents)
      .where(
        and(
          eq(conversationEvents.conversationId, conv!.id),
          eq(conversationEvents.type, 'agent.incomplete'),
        ),
      );
    expect(incomplete).toHaveLength(0);

    provider.release();
    await orchestrator.awaitExecution(executionId);

    const agentMsgs = await db
      .select()
      .from(messages)
      .where(
        and(eq(messages.conversationId, conv!.id), eq(messages.role, 'agent')),
      );
    expect(agentMsgs.some((m) => m.content.includes('lease wall-clock'))).toBe(true);

    const [finished] = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, conv!.id));
    expect(finished?.activeExecutionId).toBeNull();
  });
});
