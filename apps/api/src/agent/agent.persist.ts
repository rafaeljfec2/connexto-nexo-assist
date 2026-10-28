import { Logger } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { conversations, executionEvents, messages } from '../db/schema';
import type { ConversationEventsService } from '../events/conversation-events.service';
import type { DraftRow } from './agent.draft-store';
import type { TurnEvent } from './agent.types';

const logger = new Logger('AgentPersist');

export async function persistAgentOutcome(
  eventsService: ConversationEventsService,
  input: {
    readonly conversationId: string;
    readonly executionId: string;
    readonly agentContent: string;
    readonly events: TurnEvent[];
    readonly draft: DraftRow | null;
    readonly status: string;
    readonly summary: string | null;
  },
) {
  return eventsService.withConversationLock(input.conversationId, async (tx) => {
    const [fenced] = await tx
      .update(conversations)
      .set({
        status: input.status,
        ...(input.summary !== null ? { summary: input.summary } : {}),
        activeExecutionId: null,
        busyUntil: null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(conversations.id, input.conversationId),
          eq(conversations.activeExecutionId, input.executionId),
          eq(conversations.status, 'with_agent'),
        ),
      )
      .returning({ id: conversations.id });

    if (!fenced) {
      logger.warn(
        `Fenced discard for execution ${input.executionId} on ${input.conversationId}`,
      );
      return null;
    }

    const [agentMessage] = await tx
      .insert(messages)
      .values({
        conversationId: input.conversationId,
        role: 'agent',
        content: input.agentContent,
      })
      .returning();
    if (!agentMessage) {
      throw new Error('Failed to persist agent message');
    }

    for (const event of input.events) {
      await tx.insert(executionEvents).values({
        conversationId: input.conversationId,
        executionId: input.executionId,
        messageId: agentMessage.id,
        intent: event.intent,
        tool: event.tool,
        rule: event.rule,
        result: event.result,
        justification: event.justification,
      });
    }

    await eventsService.appendInTx(tx, {
      conversationId: input.conversationId,
      type: 'message.created',
      payload: {
        messageId: agentMessage.id,
        role: 'agent',
        content: agentMessage.content,
        executionId: input.executionId,
      },
    });
    await eventsService.appendInTx(tx, {
      conversationId: input.conversationId,
      type: 'agent.completed',
      payload: {
        executionId: input.executionId,
        messageId: agentMessage.id,
      },
    });
    if (input.status !== 'with_agent') {
      await eventsService.appendInTx(tx, {
        conversationId: input.conversationId,
        type: 'conversation.updated',
        payload: {
          status: input.status,
          summary: input.summary,
        },
      });
    }

    const storedEvents = await tx
      .select()
      .from(executionEvents)
      .where(eq(executionEvents.executionId, input.executionId));

    return {
      agentMessage,
      events: storedEvents,
      draft: input.draft,
    };
  });
}

export async function failExecution(
  eventsService: ConversationEventsService,
  input: {
    readonly conversationId: string;
    readonly executionId: string;
    readonly reason: string;
    readonly agentContent: string | null;
  },
): Promise<void> {
  await eventsService.withConversationLock(input.conversationId, async (tx) => {
    const [fenced] = await tx
      .update(conversations)
      .set({
        activeExecutionId: null,
        busyUntil: null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(conversations.id, input.conversationId),
          eq(conversations.activeExecutionId, input.executionId),
        ),
      )
      .returning({ id: conversations.id });
    if (!fenced) {
      return;
    }
    if (input.agentContent) {
      const [agentMessage] = await tx
        .insert(messages)
        .values({
          conversationId: input.conversationId,
          role: 'agent',
          content: input.agentContent,
        })
        .returning();
      if (agentMessage) {
        await eventsService.appendInTx(tx, {
          conversationId: input.conversationId,
          type: 'message.created',
          payload: {
            messageId: agentMessage.id,
            role: 'agent',
            content: agentMessage.content,
            executionId: input.executionId,
          },
        });
      }
    }
    await eventsService.appendInTx(tx, {
      conversationId: input.conversationId,
      type: 'agent.failed',
      payload: {
        executionId: input.executionId,
        reason: input.reason,
      },
    });
  });
}
