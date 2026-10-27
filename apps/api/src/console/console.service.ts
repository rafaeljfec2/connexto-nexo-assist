import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, desc, eq, inArray, isNull } from 'drizzle-orm';
import { createDb, type AppDatabase } from '../db/client';
import { conversations, messages, ticketHistory, tickets, users } from '../db/schema';

export type ConsoleTicketPayload = {
  id: string;
  number: string;
  title: string;
  status: string;
  priority: string;
  category: string;
  description: string;
  dueAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  lastHistory: { note: string; createdAt: Date } | null;
};

@Injectable()
export class ConsoleService {
  private readonly db: AppDatabase = createDb();

  async queue(filter: 'for_you' | 'with_agent' | 'mine' | 'all', analystId: string) {
    if (filter === 'for_you') {
      return this.db
        .select({
          conversation: conversations,
          employeeName: users.name,
          employeeEmail: users.email,
          employeeArea: users.area,
        })
        .from(conversations)
        .innerJoin(users, eq(users.id, conversations.employeeId))
        .where(eq(conversations.status, 'waiting_analyst'))
        .orderBy(desc(conversations.updatedAt));
    }
    if (filter === 'with_agent') {
      return this.db
        .select({
          conversation: conversations,
          employeeName: users.name,
          employeeEmail: users.email,
          employeeArea: users.area,
        })
        .from(conversations)
        .innerJoin(users, eq(users.id, conversations.employeeId))
        .where(eq(conversations.status, 'with_agent'))
        .orderBy(desc(conversations.updatedAt));
    }
    if (filter === 'mine') {
      return this.db
        .select({
          conversation: conversations,
          employeeName: users.name,
          employeeEmail: users.email,
          employeeArea: users.area,
        })
        .from(conversations)
        .innerJoin(users, eq(users.id, conversations.employeeId))
        .where(
          and(
            eq(conversations.analystId, analystId),
            eq(conversations.status, 'with_analyst'),
          ),
        )
        .orderBy(desc(conversations.updatedAt));
    }
    return this.db
      .select({
        conversation: conversations,
        employeeName: users.name,
        employeeEmail: users.email,
        employeeArea: users.area,
      })
      .from(conversations)
      .innerJoin(users, eq(users.id, conversations.employeeId))
      .orderBy(desc(conversations.updatedAt));
  }

  async getConversation(id: string) {
    const [row] = await this.db
      .select({
        conversation: conversations,
        employeeName: users.name,
        employeeEmail: users.email,
        employeeArea: users.area,
      })
      .from(conversations)
      .innerJoin(users, eq(users.id, conversations.employeeId))
      .where(eq(conversations.id, id));
    if (!row) {
      throw new NotFoundException('Conversation not found');
    }
    const history = await this.db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, id))
      .orderBy(messages.createdAt);
    const employeeTickets = await this.db
      .select()
      .from(tickets)
      .where(eq(tickets.employeeId, row.conversation.employeeId))
      .orderBy(desc(tickets.updatedAt));

    const ticketIds = employeeTickets.map((ticket) => ticket.id);
    const historyRows =
      ticketIds.length === 0
        ? []
        : await this.db
            .select()
            .from(ticketHistory)
            .where(inArray(ticketHistory.ticketId, ticketIds))
            .orderBy(desc(ticketHistory.createdAt));

    const latestByTicket = new Map<string, { note: string; createdAt: Date }>();
    for (const event of historyRows) {
      if (!latestByTicket.has(event.ticketId)) {
        latestByTicket.set(event.ticketId, {
          note: event.note,
          createdAt: event.createdAt,
        });
      }
    }

    const ticketsWithHistory: ConsoleTicketPayload[] = employeeTickets.map((ticket) => ({
      id: ticket.id,
      number: ticket.number,
      title: ticket.title,
      status: ticket.status,
      priority: ticket.priority,
      category: ticket.category,
      description: ticket.description,
      dueAt: ticket.dueAt,
      createdAt: ticket.createdAt,
      updatedAt: ticket.updatedAt,
      lastHistory: latestByTicket.get(ticket.id) ?? null,
    }));

    return { ...row, messages: history, tickets: ticketsWithHistory };
  }

  async claim(conversationId: string, analystId: string) {
    const updated = await this.db
      .update(conversations)
      .set({
        status: 'with_analyst',
        analystId,
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
      const [current] = await this.db
        .select()
        .from(conversations)
        .where(eq(conversations.id, conversationId));
      if (!current) {
        throw new NotFoundException('Conversation not found');
      }
      throw new ConflictException('Conversation already claimed.');
    }

    await this.db.insert(messages).values({
      conversationId,
      role: 'system',
      content: 'Analista assumiu o atendimento.',
    });

    return this.getConversation(conversationId);
  }

  async returnToAgent(conversationId: string, analystId: string) {
    const [current] = await this.db
      .select()
      .from(conversations)
      .where(eq(conversations.id, conversationId));
    if (!current) {
      throw new NotFoundException('Conversation not found');
    }

    // From human queue without claim: any authenticated analyst may bounce back to the agent.
    if (current.status === 'waiting_analyst') {
      const updated = await this.db
        .update(conversations)
        .set({ status: 'with_agent', analystId: null, updatedAt: new Date() })
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
      await this.db.insert(messages).values({
        conversationId,
        role: 'system',
        content: 'Atendimento devolvido ao agente.',
      });
      return this.getConversation(conversationId);
    }

    if (current.status !== 'with_analyst' || current.analystId !== analystId) {
      throw new ForbiddenException('Only the assigned analyst can return this conversation.');
    }
    const updated = await this.db
      .update(conversations)
      .set({ status: 'with_agent', analystId: null, updatedAt: new Date() })
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
    await this.db.insert(messages).values({
      conversationId,
      role: 'system',
      content: 'Atendimento devolvido ao agente.',
    });
    return this.getConversation(conversationId);
  }

  async close(conversationId: string, analystId: string) {
    const [current] = await this.db
      .select()
      .from(conversations)
      .where(eq(conversations.id, conversationId));
    if (!current) {
      throw new NotFoundException('Conversation not found');
    }
    if (current.status !== 'with_analyst' || current.analystId !== analystId) {
      throw new ForbiddenException('Only the assigned analyst can close this conversation.');
    }
    const updated = await this.db
      .update(conversations)
      .set({ status: 'closed', updatedAt: new Date() })
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
    await this.db.insert(messages).values({
      conversationId,
      role: 'system',
      content: 'Atendimento encerrado.',
    });
    return this.getConversation(conversationId);
  }

  async sendAnalystMessage(conversationId: string, analystId: string, content: string) {
    const [current] = await this.db
      .select()
      .from(conversations)
      .where(eq(conversations.id, conversationId));
    if (!current) {
      throw new NotFoundException('Conversation not found');
    }
    if (current.status !== 'with_analyst' || current.analystId !== analystId) {
      throw new ForbiddenException('Conversation is not with this analyst.');
    }
    await this.db.insert(messages).values({
      conversationId,
      role: 'analyst',
      content,
    });
    return this.getConversation(conversationId);
  }
}
