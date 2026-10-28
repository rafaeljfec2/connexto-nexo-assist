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
  const showTicketPicker =
    openTickets.length > 0 &&
    turnListedTickets(latestTurnEvents) &&
    !draftedThisTurn &&
    !showImpactChoices &&
    !payload?.draft;

  const inspectedNumber = turnInspectedTicketNumber(latestTurnEvents);
  const detailTicket = inspectedNumber
    ? (tickets.find((ticket) => ticket.number.toUpperCase() === inspectedNumber) ?? null)
    : null;
  const showDetailCard = Boolean(
    inspectedNumber &&
      detailTicket &&
      dismissedDetailNumber?.toUpperCase() !== inspectedNumber.toUpperCase(),
  );
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

export function detailCardAgentContent(input: {
  lastAgentMessage: Message | undefined;
  overdue: boolean;
  detailTicket: TicketRow;
}): string {
  const { lastAgentMessage, overdue, detailTicket } = input;
  return (
    lastAgentMessage?.content ??
    (overdue && detailTicket.updatedAt
      ? buildOverdueConsultaPrompt({
          updatedAt: new Date(detailTicket.updatedAt),
        })
      : 'Consultei o chamado selecionado.')
  );
}
