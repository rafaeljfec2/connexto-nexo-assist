import { formatShortDatePt } from '@nexo-assist/domain';
import type { ExecutionEvent } from '@/lib/api';

export const NEAR_BOTTOM_PX = 100;
export const CLIENT_TURN_TIMEOUT_MS = 30_000;

export type TicketRow = {
  id: string;
  number: string;
  title: string;
  status: string;
  priority: string;
  category: string;
  description: string;
  dueAt: string;
  createdAt: string;
  updatedAt: string;
};

export function statusTone(status: string): 'success' | 'warning' | 'danger' | 'neutral' | 'primary' {
  const value = status.toLowerCase();
  if (value.includes('resolv') || value.includes('aprov')) return 'success';
  if (value.includes('progress') || value.includes('andamento')) return 'primary';
  if (value.includes('wait') || value.includes('aguard')) return 'warning';
  return 'neutral';
}

export function formatStatus(status: string): string {
  const map: Record<string, string> = {
    waiting_analyst: 'Aguardando analista',
    in_progress: 'Em andamento',
    approved: 'Aprovado',
    resolved: 'Resolvido',
    open: 'Aberto',
  };
  return map[status] ?? status.replaceAll('_', ' ');
}

export function mapTickets(ticketRows: Array<Record<string, unknown>>): TicketRow[] {
  return ticketRows.map((t) => ({
    id: String(t['id']),
    number: String(t['number']),
    title: String(t['title']),
    status: String(t['status']),
    priority: String(t['priority']),
    category: String(t['category'] ?? t['Category'] ?? ''),
    description: String(t['description'] ?? ''),
    dueAt: String(t['dueAt'] ?? t['due_at'] ?? ''),
    createdAt: String(t['createdAt'] ?? t['created_at'] ?? ''),
    updatedAt: String(t['updatedAt'] ?? t['updated_at'] ?? ''),
  }));
}

/** PRD / Figma: ticket cards appear only after the agent called list_my_tickets this turn. */
export function turnListedTickets(events: ExecutionEvent[]): boolean {
  return events.some((event) => event.tool === 'list_my_tickets');
}

export function turnInspectedTicketNumber(events: ExecutionEvent[]): string | null {
  const inspect = events.find(
    (event) =>
      event.rule === 'ticket.inspect' ||
      event.tool === 'get_ticket',
  );
  if (!inspect) {
    return null;
  }
  const fromResult = /\b((?:INC|REQ)-\d+)\b/i.exec(inspect.result ?? '');
  if (fromResult?.[1]) {
    return fromResult[1].toUpperCase();
  }
  const fromJustification = /\b((?:INC|REQ)-\d+)\b/i.exec(inspect.justification ?? '');
  return fromJustification?.[1]?.toUpperCase() ?? null;
}

export function isOpenTicket(status: string): boolean {
  return status !== 'resolved';
}

export function compactDateFor(ticket: TicketRow): string | undefined {
  const raw = ticket.updatedAt || ticket.createdAt;
  if (!raw) {
    return undefined;
  }
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }
  return formatShortDatePt(date);
}

export function groupEventsByExecution(
  events: ExecutionEvent[],
): Record<string, ExecutionEvent[]> {
  const grouped: Record<string, ExecutionEvent[]> = {};
  for (const event of events) {
    const key = event.executionId;
    grouped[key] = [...(grouped[key] ?? []), event];
  }
  return grouped;
}
