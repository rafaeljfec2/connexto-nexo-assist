import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';
import type { AppDatabase } from '../db/client';
import { conversations, messages } from '../db/schema';
import type { ConversationEventsService } from '../events/conversation-events.service';
import { resolveLinkedTicketOnClose } from './console.resolve-on-close';

export type ConsoleActionDeps = {
  db: AppDatabase;
  events: ConversationEventsService;
};

async function appendSystemMessageAndConversationUpdated(
  events: ConversationEventsService,
  tx: Parameters<Parameters<AppDatabase['transaction']>[0]>[0],
  conversationId: string,
  systemContent: string,
  conversationPayload: Record<string, unknown>,
): Promise<void> {
  const [systemMessage] = await tx
    .insert(messages)
    .values({
      conversationId,
      role: 'system',
      content: systemContent,
    })
    .returning();

  await events.appendInTx(tx, {
    conversationId,
    type: 'message.created',
    payload: {
      messageId: systemMessage?.id,
      role: 'system',
      content: systemContent,
    },
  });
  await events.appendInTx(tx, {
    conversationId,
    type: 'conversation.updated',
    payload: conversationPayload,
  });
}

export async function claimConversation(
  deps: ConsoleActionDeps,
  conversationId: string,
  analystId: string,
): Promise<void> {
  const { events } = deps;
  await events.withConversationLock(conversationId, async (tx) => {
    const updated = await tx
      .update(conversations)
      .set({
        status: 'with_analyst',
        analystId,
        activeExecutionId: null,
        busyUntil: null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(conversations.id, conversationId),
          eq(conversations.status, 'waiting_analyst'),
          isNull(conversations.analystId),
        ),
      )
      .returning({ id: conversations.id });

    if (updated.length === 0) {
      const [current] = await tx
        .select()
        .from(conversations)
        .where(eq(conversations.id, conversationId));
      if (!current) {
        throw new NotFoundException('Conversation not found');
      }
      throw new ConflictException('Conversation already claimed.');
    }

    await appendSystemMessageAndConversationUpdated(
      events,
      tx,
      conversationId,
      'Analista assumiu o atendimento.',
      {
        status: 'with_analyst',
        analystId,
      },
    );
  });
}

async function returnWaitingAnalystToAgent(
  deps: ConsoleActionDeps,
  conversationId: string,
): Promise<void> {
  const { events } = deps;
  await events.withConversationLock(conversationId, async (tx) => {
    const updated = await tx
      .update(conversations)
      .set({
        status: 'with_agent',
        analystId: null,
        activeExecutionId: null,
        busyUntil: null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(conversations.id, conversationId),
          eq(conversations.status, 'waiting_analyst'),
        ),
      )
      .returning({ id: conversations.id });
    if (updated.length === 0) {
      throw new ConflictException('Conversation is no longer waiting for an analyst.');
    }
    await appendSystemMessageAndConversationUpdated(
      events,
      tx,
      conversationId,
      'Atendimento devolvido ao agente.',
      { status: 'with_agent', analystId: null },
    );
  });
}

async function returnWithAnalystToAgent(
  deps: ConsoleActionDeps,
  conversationId: string,
  analystId: string,
): Promise<void> {
  const { events } = deps;
  await events.withConversationLock(conversationId, async (tx) => {
    const updated = await tx
      .update(conversations)
      .set({
        status: 'with_agent',
        analystId: null,
        activeExecutionId: null,
        busyUntil: null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(conversations.id, conversationId),
          eq(conversations.status, 'with_analyst'),
          eq(conversations.analystId, analystId),
        ),
      )
      .returning({ id: conversations.id });
    if (updated.length === 0) {
      throw new ConflictException('Conversation could not be returned to the agent.');
    }
    await appendSystemMessageAndConversationUpdated(
      events,
      tx,
      conversationId,
      'Atendimento devolvido ao agente.',
      { status: 'with_agent', analystId: null },
    );
  });
}

export async function returnConversationToAgent(
  deps: ConsoleActionDeps,
  conversationId: string,
  analystId: string,
): Promise<void> {
  const { db } = deps;
  const [current] = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, conversationId));
  if (!current) {
    throw new NotFoundException('Conversation not found');
  }

  if (current.status === 'waiting_analyst') {
    await returnWaitingAnalystToAgent(deps, conversationId);
    return;
  }

  if (current.status !== 'with_analyst' || current.analystId !== analystId) {
    throw new ForbiddenException('Only the assigned analyst can return this conversation.');
  }

  await returnWithAnalystToAgent(deps, conversationId, analystId);
}

export async function closeConversation(
  deps: ConsoleActionDeps,
  conversationId: string,
  analystId: string,
): Promise<void> {
  const { db, events } = deps;
  const [current] = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, conversationId));
  if (!current) {
    throw new NotFoundException('Conversation not found');
  }
  if (current.status !== 'with_analyst' || current.analystId !== analystId) {
    throw new ForbiddenException('Only the assigned analyst can close this conversation.');
  }

  await events.withConversationLock(conversationId, async (tx) => {
    const updated = await tx
      .update(conversations)
      .set({
        status: 'closed',
        activeExecutionId: null,
        busyUntil: null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(conversations.id, conversationId),
          eq(conversations.status, 'with_analyst'),
          eq(conversations.analystId, analystId),
        ),
      )
      .returning({ id: conversations.id });
    if (updated.length === 0) {
      throw new ConflictException('Conversation could not be closed.');
    }

    const resolvedNumber = await resolveLinkedTicketOnClose(tx, {
      conversationId,
      employeeId: current.employeeId,
      summary: current.summary,
    });

    await appendSystemMessageAndConversationUpdated(
      events,
      tx,
      conversationId,
      'Atendimento encerrado.',
      {
        status: 'closed',
        analystId,
        ...(resolvedNumber ? { resolvedTicketNumber: resolvedNumber } : {}),
      },
    );
  });
}

export async function sendAnalystConversationMessage(
  deps: ConsoleActionDeps,
  conversationId: string,
  analystId: string,
  content: string,
): Promise<void> {
  const { db, events } = deps;
  const [current] = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, conversationId));
  if (!current) {
    throw new NotFoundException('Conversation not found');
  }
  if (current.status !== 'with_analyst' || current.analystId !== analystId) {
    throw new ForbiddenException('Conversation is not with this analyst.');
  }

  await events.withConversationLock(conversationId, async (tx) => {
    const [locked] = await tx
      .select()
      .from(conversations)
      .where(eq(conversations.id, conversationId))
      .for('update');
    if (!locked || locked.status !== 'with_analyst' || locked.analystId !== analystId) {
      throw new ForbiddenException('Conversation is not with this analyst.');
    }
    const [msg] = await tx
      .insert(messages)
      .values({
        conversationId,
        role: 'analyst',
        content,
      })
      .returning();
    await tx
      .update(conversations)
      .set({ updatedAt: new Date() })
      .where(eq(conversations.id, conversationId));
    await events.appendInTx(tx, {
      conversationId,
      type: 'message.created',
      payload: {
        messageId: msg?.id,
        role: 'analyst',
        content,
      },
    });
  });
}
