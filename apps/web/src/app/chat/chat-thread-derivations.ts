import {
  buildOverdueConsultaPrompt,
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
  const n = Math.max(0, openCount);
  if (n === 1) {
    return 'Você tem 1 chamado aberto. Sobre qual deles quer saber?';
  }
  return `Você tem ${n} chamados abertos. Sobre qual deles quer saber?`;
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

function looksLikeOverdueConsultaPrompt(content: string): boolean {
  const normalized = content.toLowerCase();
  return (
    normalized.includes('sem atualização') ||
    normalized.includes('prazo') ||
    normalized.includes('chame um analista') ||
    normalized.includes('falar com um analista')
  );
}
