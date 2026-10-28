import { desc, eq, inArray } from 'drizzle-orm';
import type { AppDatabase } from '../db/client';
import { ticketHistory, tickets } from '../db/schema';
import type { ConsoleTicketPayload } from './console.types';

export async function loadEmployeeTicketsWithHistory(
  db: AppDatabase,
  employeeId: string,
): Promise<ConsoleTicketPayload[]> {
  const employeeTickets = await db
    .select()
    .from(tickets)
    .where(eq(tickets.employeeId, employeeId))
    .orderBy(desc(tickets.updatedAt));

  const ticketIds = employeeTickets.map((ticket) => ticket.id);
  const historyRows =
    ticketIds.length === 0
      ? []
      : await db
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

  return employeeTickets.map((ticket) => ({
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
}
