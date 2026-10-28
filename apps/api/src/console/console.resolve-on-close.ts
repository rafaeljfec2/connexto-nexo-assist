import type { TicketStatus } from '@nexo-assist/contracts';
import { canResolve } from '@nexo-assist/domain';
import { and, desc, eq } from 'drizzle-orm';
import type { AppDatabase } from '../db/client';
import { messages, ticketHistory, tickets } from '../db/schema';

type Tx = Parameters<Parameters<AppDatabase['transaction']>[0]>[0];

const TICKET_NUMBER_RE = /\b((?:INC|REQ)-\d+)\b/i;

export function extractTicketNumber(text: string | null | undefined): string | null {
  if (!text) {
    return null;
  }
  const match = TICKET_NUMBER_RE.exec(text);
  return match?.[1]?.toUpperCase() ?? null;
}

export function pickLinkedTicketNumber(
  summary: string | null,
  messageContents: readonly string[],
): string | null {
  const fromSummary = extractTicketNumber(summary);
  if (fromSummary) {
    return fromSummary;
  }
  for (let i = messageContents.length - 1; i >= 0; i -= 1) {
    const number = extractTicketNumber(messageContents[i]);
    if (number) {
      return number;
    }
  }
  return null;
}

/**
 * When an analyst closes attendance, resolve the ticket linked to the conversation
 * (same featured pick as the console sidebar), so the employee list stays consistent.
 */
export async function resolveLinkedTicketOnClose(
  tx: Tx,
  input: {
    readonly conversationId: string;
    readonly employeeId: string;
    readonly summary: string | null;
  },
): Promise<string | null> {
  const recentMessages = await tx
    .select({ content: messages.content })
    .from(messages)
    .where(eq(messages.conversationId, input.conversationId))
    .orderBy(desc(messages.createdAt))
    .limit(40);

  const number = pickLinkedTicketNumber(
    input.summary,
    recentMessages.map((row) => row.content).reverse(),
  );
  if (!number) {
    return null;
  }

  const [ticket] = await tx
    .select()
    .from(tickets)
    .where(and(eq(tickets.number, number), eq(tickets.employeeId, input.employeeId)))
    .limit(1);
  if (!ticket) {
    return null;
  }

  const allowed = canResolve(ticket.status as TicketStatus);
  if (!allowed.allowed) {
    return null;
  }

  const now = new Date();
  await tx
    .update(tickets)
    .set({
      status: 'resolved',
      resolvedAt: now,
      updatedAt: now,
    })
    .where(eq(tickets.id, ticket.id));

  await tx.insert(ticketHistory).values({
    ticketId: ticket.id,
    fromStatus: ticket.status,
    toStatus: 'resolved',
    note: 'Chamado resolvido ao encerrar o atendimento.',
  });

  return ticket.number;
}
