import type { AppDatabase } from '../client';
import {
  conversationEvents,
  conversations,
  drafts,
  executionEvents,
  helpArticles,
  messages,
  operations,
  seedMeta,
  sessions,
  ticketHistory,
  tickets,
  users,
} from '../schema';

export async function wipeDemoTables(db: AppDatabase): Promise<void> {
  await db.delete(executionEvents);
  await db.delete(conversationEvents);
  await db.delete(drafts);
  await db.delete(messages);
  await db.delete(conversations);
  await db.delete(ticketHistory);
  await db.delete(tickets);
  await db.delete(operations);
  await db.delete(helpArticles);
  await db.delete(sessions);
  await db.delete(users);
  await db.delete(seedMeta);
}
