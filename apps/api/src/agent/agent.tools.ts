import {
  buildOverdueConsultaPrompt,
  MEDIUM_SLA_BUSINESS_DAYS,
} from '@nexo-assist/domain';
import type { AppDatabase } from '../db/client';
import { helpArticles } from '../db/schema';
import type { TicketGateway } from '../tickets/ticket.gateway';
import type { LlmToolDefinition } from './llm.provider';

export const AGENT_TOOLS: LlmToolDefinition[] = [
  {
    name: 'search_help',
    description: 'Search the IT help center by text tokens or error code.',
    parameters: {
      type: 'object',
      properties: { query: { type: 'string' } },
      required: ['query'],
    },
  },
  {
    name: 'list_my_tickets',
    description: 'List tickets owned by the authenticated employee.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'get_ticket',
    description:
      'Inspect one ticket owned by the authenticated employee by number or id. Use after the employee selects a ticket from the list.',
    parameters: {
      type: 'object',
      properties: {
        ticketNumber: { type: 'string' },
        ticketId: { type: 'string' },
      },
    },
  },
  {
    name: 'prepare_draft',
    description:
      'Prepare a versioned draft for create/update/reopen/transfer. Does not mutate tickets.',
    parameters: {
      type: 'object',
      properties: {
        action: { type: 'string' },
        title: { type: 'string' },
        description: { type: 'string' },
        category: { type: 'string' },
        type: { type: 'string' },
        ticketId: { type: 'string' },
        errorCode: { type: 'string' },
        affectedScope: { type: 'string' },
        workStopped: { type: 'boolean' },
        sameDayCommitment: { type: 'boolean' },
        hasAlternative: { type: 'boolean' },
      },
      required: ['action'],
    },
  },
];

export type TicketInspectResult = {
  readonly id: string;
  readonly number: string;
  readonly title: string;
  readonly description: string;
  readonly status: string;
  readonly priority: string;
  readonly category: string;
  readonly dueAt: string;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export function serializeTicketRow(t: {
  id: string;
  number: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  category: string;
  dueAt: Date;
  createdAt: Date;
  updatedAt: Date;
}): TicketInspectResult {
  return {
    id: t.id,
    number: t.number,
    title: t.title,
    description: t.description,
    status: t.status,
    priority: t.priority,
    category: t.category,
    dueAt: t.dueAt.toISOString(),
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  };
}

export function asTicketInspectResult(value: unknown): TicketInspectResult | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  const row = value as Record<string, unknown>;
  if (typeof row['error'] === 'string') {
    return null;
  }
  if (typeof row['number'] !== 'string' || typeof row['dueAt'] !== 'string') {
    return null;
  }
  return {
    id: String(row['id'] ?? ''),
    number: row['number'],
    title: String(row['title'] ?? ''),
    description: String(row['description'] ?? ''),
    status: String(row['status'] ?? ''),
    priority: String(row['priority'] ?? ''),
    category: String(row['category'] ?? ''),
    dueAt: row['dueAt'],
    createdAt: String(row['createdAt'] ?? ''),
    updatedAt: String(row['updatedAt'] ?? ''),
  };
}

export function buildConsultaDetailReply(
  ticket: TicketInspectResult,
  overdue: boolean,
): string {
  if (!overdue) {
    return `Consultei o ${ticket.number} (${ticket.title}). Status atual: ${ticket.status}. Posso explicar o prazo ou complementar o chamado se precisar.`;
  }
  return buildOverdueConsultaPrompt({
    updatedAt: new Date(ticket.updatedAt || ticket.createdAt || Date.now()),
    businessDays: MEDIUM_SLA_BUSINESS_DAYS,
  });
}

export async function runAgentTool(
  db: AppDatabase,
  tickets: TicketGateway,
  name: string,
  args: Record<string, unknown>,
  employeeId: string,
): Promise<unknown> {
  if (name === 'search_help') {
    const query = String(args['query'] ?? '')
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);
    const articles = await db.select().from(helpArticles);
    const hits = articles.filter((a) => {
      const hay =
        `${a.title} ${a.body} ${a.tags.join(' ')} ${a.errorCodes.join(' ')}`.toLowerCase();
      return query.some((q) => hay.includes(q));
    });
    return hits.slice(0, 3).map((a) => ({
      slug: a.slug,
      title: a.title,
      body: a.body,
      isDemo: a.isDemo,
    }));
  }
  if (name === 'list_my_tickets') {
    const open = await tickets.listOpenForDuplicity(employeeId);
    return open.map((t) => serializeTicketRow(t));
  }
  if (name === 'get_ticket') {
    const numberOrId = String(args['ticketNumber'] ?? args['ticketId'] ?? '').trim();
    const ticket = await tickets.findOwnedByNumberOrId(employeeId, numberOrId);
    if (!ticket) {
      return { error: 'not_found' };
    }
    return serializeTicketRow(ticket);
  }
  if (name === 'prepare_draft') {
    return { accepted: true, payload: args };
  }
  return { error: 'unknown_tool' };
}
