import { NotFoundException } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import type { AppDatabase } from '../db/client';
import { conversations, messages, users } from '../db/schema';
import { loadEmployeeTicketsWithHistory } from './console.tickets';
import type { ConsoleQueueFilter } from './console.types';

const queueSelectShape = {
  conversation: conversations,
  employeeName: users.name,
  employeeEmail: users.email,
  employeeArea: users.area,
} as const;

function queueBaseQuery(db: AppDatabase) {
  return db
    .select(queueSelectShape)
    .from(conversations)
    .innerJoin(users, eq(users.id, conversations.employeeId));
}

export async function fetchQueue(
  db: AppDatabase,
  filter: ConsoleQueueFilter,
  analystId: string,
) {
  if (filter === 'for_you') {
    return queueBaseQuery(db)
      .where(eq(conversations.status, 'waiting_analyst'))
      .orderBy(desc(conversations.updatedAt));
  }
  if (filter === 'with_agent') {
    return queueBaseQuery(db)
      .where(eq(conversations.status, 'with_agent'))
      .orderBy(desc(conversations.updatedAt));
  }
  if (filter === 'mine') {
    return queueBaseQuery(db)
      .where(
        and(
          eq(conversations.analystId, analystId),
          eq(conversations.status, 'with_analyst'),
        ),
      )
      .orderBy(desc(conversations.updatedAt));
  }
  return queueBaseQuery(db).orderBy(desc(conversations.updatedAt));
}

export async function fetchConversationDetail(db: AppDatabase, id: string) {
  const [row] = await db
    .select(queueSelectShape)
    .from(conversations)
    .innerJoin(users, eq(users.id, conversations.employeeId))
    .where(eq(conversations.id, id));
  if (!row) {
    throw new NotFoundException('Conversation not found');
  }
  const history = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, id))
    .orderBy(messages.createdAt);
  const ticketsWithHistory = await loadEmployeeTicketsWithHistory(
    db,
    row.conversation.employeeId,
  );

  return { ...row, messages: history, tickets: ticketsWithHistory };
}
