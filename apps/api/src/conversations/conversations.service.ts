import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { createDb, type AppDatabase } from '../db/client';
import { conversations, drafts, executionEvents, messages } from '../db/schema';
import { AgentOrchestrator } from '../agent/agent.orchestrator';
import { UsageGuard } from './usage.guard';

const OPEN_STATUSES = ['with_analyst', 'waiting_analyst', 'with_agent'] as const;

@Injectable()
export class ConversationsService {
  private readonly db: AppDatabase;

  constructor(
    @Inject(AgentOrchestrator) private readonly orchestrator: AgentOrchestrator,
    @Inject(UsageGuard) private readonly usage: UsageGuard,
  ) {
    this.db = createDb();
  }

  /**
   * Returns the employee's current open conversation.
   * Paused human-handoff states win over with_agent so transfer cannot be bypassed
   * by creating a fresh agent conversation (and resetting the 30-message budget).
   */
  async getOrCreateCurrent(employeeId: string) {
    const openRows = await this.db
      .select()
      .from(conversations)
      .where(
        and(
          eq(conversations.employeeId, employeeId),
          inArray(conversations.status, [...OPEN_STATUSES]),
        ),
      )
      .orderBy(desc(conversations.updatedAt));

    const withAnalyst = openRows.find((row) => row.status === 'with_analyst');
    if (withAnalyst) {
      return this.hydrate(withAnalyst.id);
    }

    const waitingAnalyst = openRows.find((row) => row.status === 'waiting_analyst');
    if (waitingAnalyst) {
      return this.hydrate(waitingAnalyst.id);
    }

    const withAgent = openRows.find((row) => row.status === 'with_agent');
    if (withAgent) {
      return this.hydrate(withAgent.id);
    }

    const [created] = await this.db
      .insert(conversations)
      .values({ employeeId, status: 'with_agent' })
      .returning();

    if (!created) {
      throw new Error('Failed to load conversation');
    }

    return this.hydrate(created.id);
  }

  async hydrate(conversationId: string) {
    const [conversation] = await this.db
      .select()
      .from(conversations)
      .where(eq(conversations.id, conversationId));
    const messageRows = await this.db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(messages.createdAt);
    const events = await this.db
      .select()
      .from(executionEvents)
      .where(eq(executionEvents.conversationId, conversationId))
      .orderBy(executionEvents.createdAt);
    const pendingDrafts = await this.db
      .select()
      .from(drafts)
      .where(and(eq(drafts.conversationId, conversationId), eq(drafts.status, 'pending')))
      .orderBy(desc(drafts.createdAt))
      .limit(1);

    return {
      conversation,
      messages: messageRows,
      events,
      draft: pendingDrafts[0] ?? null,
    };
  }

  async sendMessage(employeeId: string, content: string) {
    this.usage.assertMessageSize(content);
    const current = await this.getOrCreateCurrent(employeeId);
    if (!current.conversation) {
      throw new Error('Missing conversation');
    }
    return this.orchestrator.handleEmployeeMessage({
      employeeId,
      conversationId: current.conversation.id,
      content,
    });
  }

  async confirmDraft(
    employeeId: string,
    body: { draftId: string; version: number; confirm: boolean },
  ) {
    const current = await this.getOrCreateCurrent(employeeId);
    if (!current.conversation) {
      throw new Error('Missing conversation');
    }
    return this.orchestrator.confirmDraft({
      employeeId,
      conversationId: current.conversation.id,
      draftId: body.draftId,
      version: body.version,
      confirm: body.confirm,
    });
  }
}
