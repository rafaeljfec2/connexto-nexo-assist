import {
  buildOverdueConsultaPrompt,
  buildTicketListIntro,
  MEDIUM_SLA_BUSINESS_DAYS,
} from '@nexo-assist/domain';
import type { AppDatabase } from '../../db/client';
import { helpArticles } from '../../db/schema';
import type { TicketGateway } from '../../tickets/ticket.gateway';
import type { LlmToolDefinition } from '../providers/llm.provider';
import { parseAffectedScope } from '../intents/impact-answer';
import type { TurnEvent } from '../agent.types';

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
      'Prepare a versioned draft for create/update/reopen/transfer. Does not mutate tickets. For complement use action=update with ticketId (or ticketNumber) and description of the new information only. Never use action=create for "Adicionar informação".',
    parameters: {
      type: 'object',
      properties: {
        action: { type: 'string' },
        title: { type: 'string' },
        description: { type: 'string' },
        category: { type: 'string' },
        type: { type: 'string' },
        ticketId: { type: 'string' },
        ticketNumber: { type: 'string' },
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

const TICKET_STATUS_LABEL_PT: Record<string, string> = {
  waiting_analyst: 'aguardando analista',
  in_progress: 'em andamento',
  approved: 'aprovado',
  resolved: 'resolvido',
  transferred: 'transferido',
};

/** Human-readable ticket status for agent replies (never leak enum tokens). */
export function formatTicketStatusLabel(status: string): string {
  const key = status.trim().toLowerCase();
  return TICKET_STATUS_LABEL_PT[key] ?? status.replaceAll('_', ' ');
}

export function buildConsultaDetailReply(
  ticket: TicketInspectResult,
  overdue: boolean,
): string {
  if (!overdue) {
    const statusLabel = formatTicketStatusLabel(ticket.status);
    return `Consultei o ${ticket.number} (${ticket.title}). Status atual: ${statusLabel}. Posso explicar o prazo ou complementar o chamado se precisar.`;
  }
  return buildOverdueConsultaPrompt({
    updatedAt: new Date(ticket.updatedAt || ticket.createdAt || Date.now()),
    businessDays: MEDIUM_SLA_BUSINESS_DAYS,
  });
}

/**
 * When the turn only listed tickets (Consulta C2), discard LLM enumerations and
 * persist the short Figma intro — the UI TicketPicker owns the list.
 */
export function resolveListOnlyAssistantText(input: {
  readonly events: readonly TurnEvent[];
  readonly listedOpenCount: number | null;
  readonly fallback: string;
  /** When set, skip override for impact-chip answers mid Novo chamado. */
  readonly userContent?: string;
}): string {
  if (input.userContent && parseAffectedScope(input.userContent)) {
    return input.fallback;
  }
  const tools = new Set(
    input.events.map((event) => event.tool).filter((tool): tool is string => Boolean(tool)),
  );
  const listedOnly =
    tools.has('list_my_tickets') &&
    !tools.has('get_ticket') &&
    !tools.has('search_help') &&
    !tools.has('prepare_draft');
  if (listedOnly && input.listedOpenCount != null) {
    return buildTicketListIntro(input.listedOpenCount);
  }
  return input.fallback;
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
