import {
  ConflictException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { conversations, messages } from '../../db/schema';
import type { ConversationEventsService } from '../../events/conversation-events.service';
import { AGENT_LEASE_MS } from './agent.lease';

export type AcceptMessageResult = {
  readonly accepted: true;
  readonly executionId: string | null;
  readonly clientMessageId: string | null;
  readonly employeeMessage: typeof messages.$inferSelect;
  readonly employeeMessageCount: number;
  readonly conversationStatus: string;
};

export async function acceptHumanMessage(input: {
  readonly events: ConversationEventsService;
  readonly conversation: typeof conversations.$inferSelect;
  readonly content: string;
  readonly clientMessageId: string | null;
}): Promise<AcceptMessageResult> {
  return input.events.withConversationLock(input.conversation.id, async (tx) => {
    const [employeeMessage] = await tx
      .insert(messages)
      .values({
        conversationId: input.conversation.id,
        role: 'employee',
        content: input.content,
        clientMessageId: input.clientMessageId,
      })
      .returning();
    if (!employeeMessage) {
      throw new Error('Failed to persist employee message');
    }

    const nextCount = input.conversation.employeeMessageCount + 1;
    await tx
      .update(conversations)
      .set({
        employeeMessageCount: nextCount,
        updatedAt: new Date(),
      })
      .where(eq(conversations.id, input.conversation.id));

    await input.events.appendInTx(tx, {
      conversationId: input.conversation.id,
      type: 'message.created',
      payload: {
        messageId: employeeMessage.id,
        role: 'employee',
        content: employeeMessage.content,
        clientMessageId: employeeMessage.clientMessageId,
      },
    });

    return {
      accepted: true as const,
      executionId: null,
      clientMessageId: employeeMessage.clientMessageId,
      employeeMessage,
      employeeMessageCount: nextCount,
      conversationStatus: input.conversation.status,
    };
  });
}

export async function acceptAgentMessage(input: {
  readonly events: ConversationEventsService;
  readonly conversation: typeof conversations.$inferSelect;
  readonly content: string;
  readonly clientMessageId: string | null;
}): Promise<AcceptMessageResult & { readonly executionId: string }> {
  const now = new Date();
  const executionId = randomUUID();
  const busyDeadline = new Date(now.getTime() + AGENT_LEASE_MS);

  const accepted = await input.events.withConversationLock(
    input.conversation.id,
    async (tx) => {
      const [locked] = await tx
        .select()
        .from(conversations)
        .where(eq(conversations.id, input.conversation.id))
        .for('update');

      if (!locked || locked.status !== 'with_agent') {
        throw new UnprocessableEntityException('Conversa inválida para o agente.');
      }

      if (locked.busyUntil && locked.busyUntil.getTime() > now.getTime()) {
        throw new ConflictException(
          'Já existe uma execução do agente em andamento nesta conversa.',
        );
      }

      if (
        locked.activeExecutionId &&
        (!locked.busyUntil || locked.busyUntil.getTime() <= now.getTime())
      ) {
        await input.events.appendInTx(tx, {
          conversationId: locked.id,
          type: 'agent.incomplete',
          payload: {
            executionId: locked.activeExecutionId,
            reason: 'lease_expired',
          },
        });
      }

      const [employeeMessage] = await tx
        .insert(messages)
        .values({
          conversationId: locked.id,
          role: 'employee',
          content: input.content,
          clientMessageId: input.clientMessageId,
        })
        .returning();
      if (!employeeMessage) {
        throw new Error('Failed to persist employee message');
      }

      const nextCount = locked.employeeMessageCount + 1;
      await tx
        .update(conversations)
        .set({
          activeExecutionId: executionId,
          busyUntil: busyDeadline,
          employeeMessageCount: nextCount,
          updatedAt: new Date(),
        })
        .where(eq(conversations.id, locked.id));

      await input.events.appendInTx(tx, {
        conversationId: locked.id,
        type: 'message.created',
        payload: {
          messageId: employeeMessage.id,
          role: 'employee',
          content: employeeMessage.content,
          clientMessageId: employeeMessage.clientMessageId,
          executionId,
        },
      });
      await input.events.appendInTx(tx, {
        conversationId: locked.id,
        type: 'agent.started',
        payload: { executionId },
      });

      return {
        accepted: true as const,
        executionId,
        clientMessageId: employeeMessage.clientMessageId,
        employeeMessage,
        employeeMessageCount: nextCount,
        conversationStatus: 'with_agent' as const,
      };
    },
  );

  return accepted;
}
