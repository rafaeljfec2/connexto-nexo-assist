import {
  buildOverdueConsultaPrompt,
  buildTicketListIntro,
  isTicketOverdue,
} from '@nexo-assist/domain';
import type { ConversationPayload, ExecutionEvent, Message } from '@/lib/api';
import { messageAsksImpact } from '@/components/ChoiceOptions';
import {
  isOpenTicket,
  turnInspectedTicketNumber,
  turnListedTickets,
  type TicketRow,
} from './chat-helpers';

export type ChatThreadDerivations = {
  messages: Message[];
  allEvents: ExecutionEvent[];
  lastAgentIndex: number | undefined;
  latestExecutionId: string | undefined;
  latestTurnEvents: ExecutionEvent[];
  lastAgentMessage: Message | undefined;
  showImpactChoices: boolean;
  openTickets: TicketRow[];
  showTicketPicker: boolean;
  inspectedNumber: string | null;
  detailTicket: TicketRow | null;
  showDetailCard: boolean;
  overdue: boolean;
};

export function deriveChatThreadUi(input: {
  payload: ConversationPayload | null;
  tickets: TicketRow[];
  turnEvents: Record<string, ExecutionEvent[]>;
  agentPaused: boolean;
  dismissedDetailNumber: string | null;
}): ChatThreadDerivations {
  const { payload, tickets, turnEvents, agentPaused, dismissedDetailNumber } = input;
  const messages = payload?.messages ?? [];
  const allEvents = payload?.events ?? [];
  const lastAgentIndex = [...messages]
    .map((m, i) => ({ m, i }))
    .reverse()
    .find(({ m }) => m.role === 'agent' || m.role === 'assistant')?.i;
  const latestExecutionId = allEvents.at(-1)?.executionId;
  const latestTurnEvents = latestExecutionId
    ? (turnEvents[latestExecutionId] ??
      allEvents.filter((event) => event.executionId === latestExecutionId))
    : [];
  const lastAgentMessage =
    lastAgentIndex != null ? messages[lastAgentIndex] : undefined;
  const showImpactChoices =
    !agentPaused &&
    !payload?.draft &&
    Boolean(lastAgentMessage && messageAsksImpact(lastAgentMessage.content));
  const draftedThisTurn = latestTurnEvents.some((event) => event.tool === 'prepare_draft');
  const openTickets = tickets.filter((ticket) => isOpenTicket(ticket.status));

  const inspectedNumber = turnInspectedTicketNumber(latestTurnEvents);
  const detailTicket = inspectedNumber
    ? (tickets.find((ticket) => ticket.number.toUpperCase() === inspectedNumber) ?? null)
    : null;
  const showDetailCard = Boolean(
    inspectedNumber &&
      detailTicket &&
      dismissedDetailNumber?.toUpperCase() !== inspectedNumber.toUpperCase(),
  );
  const showTicketPicker =
    openTickets.length > 0 &&
    turnListedTickets(latestTurnEvents) &&
    !draftedThisTurn &&
    !showImpactChoices &&
    !payload?.draft &&
    !showDetailCard;
  const overdue =
    detailTicket && detailTicket.dueAt
      ? isTicketOverdue({
          dueAt: new Date(detailTicket.dueAt),
          status: detailTicket.status,
        })
      : false;

  return {
    messages,
    allEvents,
    lastAgentIndex,
    latestExecutionId,
    latestTurnEvents,
    lastAgentMessage,
    showImpactChoices,
    openTickets,
    showTicketPicker,
    inspectedNumber,
    detailTicket,
    showDetailCard,
    overdue,
  };
}

/**
 * Figma Consulta: ticket picker already lists numbers/titles — bubble is only the short intro.
 */
export function ticketPickerIntroContent(openCount: number): string {
  return buildTicketListIntro(openCount);
}

/** LLM sometimes enumerates tickets in text; never show that in the bubble. */
export function looksLikeTicketEnumeration(content: string): boolean {
  const matches = content.match(/\b(?:INC|REQ)-\d+/gi) ?? [];
  return matches.length >= 2;
}

export function looksLikeTicketListIntro(content: string): boolean {
  const normalized = content.toLowerCase();
  return (
    looksLikeTicketEnumeration(content) ||
    (normalized.includes('chamado') &&
      (normalized.includes('sobre qual') || normalized.includes('abertos')))
  );
}

export function isTicketSelectionMessage(content: string): boolean {
  return /^(?:INC|REQ)-\d+\s*·/i.test(content.trim());
}

export function ticketNumberFromSelectionMessage(content: string): string | null {
  const match = /^(INC|REQ)-\d+/i.exec(content.trim());
  return match?.[0]?.toUpperCase() ?? null;
}

export function resolveSelectedTicketId(input: {
  readonly selectedTicketId: string | null;
  readonly detailTicket: TicketRow | null;
  readonly messages: Message[];
  readonly openTickets: TicketRow[];
}): string | null {
  if (input.selectedTicketId) {
    return input.selectedTicketId;
  }
  if (input.detailTicket) {
    return input.detailTicket.id;
  }
  for (let i = input.messages.length - 1; i >= 0; i--) {
    const message = input.messages[i];
    if (!message || message.role !== 'employee') {
      continue;
    }
    if (!isTicketSelectionMessage(message.content)) {
      continue;
    }
    const number = ticketNumberFromSelectionMessage(message.content);
    if (!number) {
      continue;
    }
    const ticket = input.openTickets.find(
      (row) => row.number.toUpperCase() === number,
    );
    return ticket?.id ?? null;
  }
  return null;
}

export function looksLikeConsultaDetailDump(content: string): boolean {
  return /^consultei o (?:inc|req)-\d+/i.test(content.trim());
}

/**
 * Figma: each ticket selection keeps its detail card in-thread under that turn.
 * `afterIndex` is the agent reply index when present, otherwise the selection message.
 */
export function findConsultaDetailBlocks(
  messages: Message[],
  tickets: TicketRow[],
): Array<{ afterIndex: number; ticket: TicketRow; agentIndex: number | null }> {
  const blocks: Array<{
    afterIndex: number;
    ticket: TicketRow;
    agentIndex: number | null;
  }> = [];
  for (let i = 0; i < messages.length; i++) {
    const message = messages[i];
    if (!message || message.role !== 'employee' || !isTicketSelectionMessage(message.content)) {
      continue;
    }
    const number = ticketNumberFromSelectionMessage(message.content);
    if (!number) {
      continue;
    }
    const ticket = tickets.find((row) => row.number.toUpperCase() === number);
    if (!ticket) {
      continue;
    }
    const next = messages[i + 1];
    const nextIsAgent =
      next && (next.role === 'agent' || next.role === 'assistant');
    blocks.push({
      afterIndex: nextIsAgent ? i + 1 : i,
      ticket,
      agentIndex: nextIsAgent ? i + 1 : null,
    });
  }
  return blocks;
}

/**
 * Figma Consulta: every list-intro agent reply gets its own picker underneath.
 * Returns all matching message indexes (oldest → newest).
 */
export function findTicketPickerAnchorIndexes(messages: Message[]): number[] {
  const indexes: number[] = [];
  for (let i = 0; i < messages.length; i++) {
    const current = messages[i];
    if (!current) {
      continue;
    }
    if (
      (current.role === 'agent' || current.role === 'assistant') &&
      looksLikeTicketListIntro(current.content)
    ) {
      indexes.push(i);
    }
  }
  return indexes;
}

/** @deprecated Prefer findTicketPickerAnchorIndexes — kept for call-site migration. */
export function findTicketPickerAnchorIndex(messages: Message[]): number | null {
  const indexes = findTicketPickerAnchorIndexes(messages);
  return indexes.at(-1) ?? null;
}

/**
 * Picker under a given intro stays interactive until the employee selects a
 * ticket after that intro (and before the next list intro).
 */
export function isTicketPickerInteractive(
  messages: Message[],
  anchorIndex: number,
): boolean {
  for (let i = anchorIndex + 1; i < messages.length; i++) {
    const message = messages[i];
    if (!message) {
      continue;
    }
    if (
      (message.role === 'agent' || message.role === 'assistant') &&
      looksLikeTicketListIntro(message.content)
    ) {
      return true;
    }
    if (message.role === 'employee' && isTicketSelectionMessage(message.content)) {
      return false;
    }
  }
  return true;
}

/** Selection that belongs to this list intro (first selection until next intro). */
export function selectedTicketIdForPickerAnchor(input: {
  readonly messages: Message[];
  readonly anchorIndex: number;
  readonly openTickets: TicketRow[];
}): string | null {
  for (let i = input.anchorIndex + 1; i < input.messages.length; i++) {
    const message = input.messages[i];
    if (!message) {
      continue;
    }
    if (
      (message.role === 'agent' || message.role === 'assistant') &&
      looksLikeTicketListIntro(message.content)
    ) {
      return null;
    }
    if (message.role !== 'employee' || !isTicketSelectionMessage(message.content)) {
      continue;
    }
    const number = ticketNumberFromSelectionMessage(message.content);
    if (!number) {
      return null;
    }
    return (
      input.openTickets.find((row) => row.number.toUpperCase() === number)?.id ?? null
    );
  }
  return null;
}

/** Events for the most recent list_my_tickets turn (chips above the picker intro). */
export function findListTurnEvents(
  allEvents: ExecutionEvent[],
  turnEvents: Record<string, ExecutionEvent[]>,
): ExecutionEvent[] {
  const executions = Object.keys(turnEvents);
  for (let i = executions.length - 1; i >= 0; i--) {
    const id = executions[i];
    if (!id) {
      continue;
    }
    const events = turnEvents[id] ?? [];
    if (turnListedTickets(events) && !turnInspectedTicketNumber(events)) {
      return events;
    }
  }
  const grouped = new Map<string, ExecutionEvent[]>();
  for (const event of allEvents) {
    const bucket = grouped.get(event.executionId) ?? [];
    bucket.push(event);
    grouped.set(event.executionId, bucket);
  }
  const ids = [...grouped.keys()];
  for (let i = ids.length - 1; i >= 0; i--) {
    const id = ids[i];
    if (!id) {
      continue;
    }
    const events = grouped.get(id) ?? [];
    if (turnListedTickets(events) && !turnInspectedTicketNumber(events)) {
      return events;
    }
  }
  return [];
}

/**
 * Figma Consulta detail: TicketCard already shows status/title — bubble is only the overdue
 * prompt (with action chips). Non-overdue detail has no redundant agent text under the card.
 */
export function detailCardAgentContent(input: {
  lastAgentMessage: Message | undefined;
  overdue: boolean;
  detailTicket: TicketRow;
}): string | null {
  const { lastAgentMessage, overdue, detailTicket } = input;
  if (!overdue) {
    return null;
  }
  if (lastAgentMessage?.content && looksLikeOverdueConsultaPrompt(lastAgentMessage.content)) {
    return lastAgentMessage.content;
  }
  if (detailTicket.updatedAt) {
    return buildOverdueConsultaPrompt({
      updatedAt: new Date(detailTicket.updatedAt),
    });
  }
  return null;
}

export function looksLikeOverdueConsultaPrompt(content: string): boolean {
  const normalized = content.toLowerCase();
  return (
    normalized.includes('sem atualização') ||
    normalized.includes('sem atualizacao') ||
    normalized.includes('chame um analista') ||
    (normalized.includes('prazo') && normalized.includes('prioridade'))
  );
}
