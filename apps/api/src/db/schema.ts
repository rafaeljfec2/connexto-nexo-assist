import {
  boolean,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  area: text('area').notNull(),
  role: text('role').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id),
  tokenHash: text('token_hash').notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const helpArticles = pgTable('help_articles', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').notNull().unique(),
  title: text('title').notNull(),
  body: text('body').notNull(),
  tags: text('tags').array().notNull().default([]),
  errorCodes: text('error_codes').array().notNull().default([]),
  isDemo: boolean('is_demo').notNull().default(true),
});

export const tickets = pgTable(
  'tickets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    number: text('number').notNull().unique(),
    employeeId: uuid('employee_id')
      .notNull()
      .references(() => users.id),
    type: text('type').notNull(),
    category: text('category').notNull(),
    title: text('title').notNull(),
    description: text('description').notNull(),
    errorCode: text('error_code'),
    priority: text('priority').notNull(),
    status: text('status').notNull(),
    dueAt: timestamp('due_at', { withTimezone: true }).notNull(),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('tickets_employee_idx').on(t.employeeId)],
);

export const ticketHistory = pgTable('ticket_history', {
  id: uuid('id').primaryKey().defaultRandom(),
  ticketId: uuid('ticket_id')
    .notNull()
    .references(() => tickets.id),
  fromStatus: text('from_status'),
  toStatus: text('to_status').notNull(),
  note: text('note').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const conversations = pgTable('conversations', {
  id: uuid('id').primaryKey().defaultRandom(),
  employeeId: uuid('employee_id')
    .notNull()
    .references(() => users.id),
  status: text('status').notNull().default('with_agent'),
  analystId: uuid('analyst_id').references(() => users.id),
  employeeMessageCount: integer('employee_message_count').notNull().default(0),
  summary: text('summary'),
  busyUntil: timestamp('busy_until', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const messages = pgTable(
  'messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversations.id),
    role: text('role').notNull(),
    content: text('content').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('messages_conversation_idx').on(t.conversationId)],
);

export const drafts = pgTable('drafts', {
  id: uuid('id').primaryKey().defaultRandom(),
  conversationId: uuid('conversation_id')
    .notNull()
    .references(() => conversations.id),
  version: integer('version').notNull(),
  action: text('action').notNull(),
  payload: jsonb('payload').notNull().$type<Record<string, unknown>>(),
  ticketId: uuid('ticket_id'),
  status: text('status').notNull().default('pending'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const executionEvents = pgTable('execution_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  conversationId: uuid('conversation_id')
    .notNull()
    .references(() => conversations.id),
  executionId: uuid('execution_id').notNull(),
  messageId: uuid('message_id'),
  intent: text('intent'),
  tool: text('tool'),
  rule: text('rule'),
  result: text('result').notNull(),
  justification: text('justification').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const operations = pgTable(
  'operations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    operationId: text('operation_id').notNull(),
    kind: text('kind').notNull(),
    result: jsonb('result').notNull().$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('operations_operation_id_uidx').on(t.operationId)],
);

export const seedMeta = pgTable('seed_meta', {
  id: text('id').primaryKey(),
  appliedAt: timestamp('applied_at', { withTimezone: true }).notNull().defaultNow(),
});
