import {
  formatCategoryLabel,
  formatOpenedAtPt,
  formatPriorityPt,
  formatRelativeUpdatePt,
  isTicketOverdue,
} from '@nexo-assist/domain';
import type { ConversationPayload, ExecutionEvent, Message } from '@/lib/api';
import { ChatBubble } from '@/components/ChatBubble';
import { ChoiceOptions } from '@/components/ChoiceOptions';
import { DraftConfirmCard } from '@/components/DraftConfirmCard';
import { EventChips } from '@/components/EventChips';
import { OptionChips } from '@/components/OptionChips';
import { TicketCard } from '@/components/TicketCard';
import { TicketPickerList } from '@/components/TicketPickerList';
import {
  compactDateFor,
  formatStatus,
  statusTone,
  type TicketRow,
} from './chat-helpers';
import {
  detailCardAgentContent,
  findConsultaDetailBlocks,
  findListTurnEvents,
  findTicketPickerAnchorIndexes,
  isTicketPickerInteractive,
  looksLikeConsultaDetailDump,
  looksLikeOverdueConsultaPrompt,
  looksLikeTicketEnumeration,
  looksLikeTicketListIntro,
  selectedTicketIdForPickerAnchor,
  ticketPickerIntroContent,
} from './chat-thread-derivations';

export type ChatThreadViewProps = {
  messages: Message[];
  payload: ConversationPayload | null;
  lastAgentIndex: number | undefined;
  latestTurnEvents: ExecutionEvent[];
  showDetailCard: boolean;
  showImpactChoices: boolean;
  showTicketPicker: boolean;
  openTickets: TicketRow[];
  tickets: TicketRow[];
  detailTicket: TicketRow | null;
  overdue: boolean;
  lastAgentMessage: Message | undefined;
  selectedTicketId: string | null;
  sending: boolean;
  inputLocked: boolean;
  pendingExecutionId: string | null;
  incompleteHint: string | null;
  retryContent: string | null;
  onSendContent: (content: string) => void;
  onRetryIncomplete: () => void;
  onSelectTicket: (ticket: TicketRow) => void;
  onDismissDetail: (ticketNumber: string) => void;
  onConfirmDraft: (confirm: boolean) => void;
  onEditDraft: (title: string) => void;
};

export function ChatThreadView(props: ChatThreadViewProps) {
  const {
    messages,
    payload,
    lastAgentIndex,
    latestTurnEvents,
    showDetailCard,
    showImpactChoices,
    showTicketPicker,
    openTickets,
    tickets,
    detailTicket,
    overdue,
    lastAgentMessage,
    selectedTicketId,
    sending,
    inputLocked,
    pendingExecutionId,
    incompleteHint,
    retryContent,
    onSendContent,
    onRetryIncomplete,
    onSelectTicket,
    onDismissDetail,
    onConfirmDraft,
    onEditDraft,
  } = props;

  const pickerAnchorIndexes =
    openTickets.length > 0 ? findTicketPickerAnchorIndexes(messages) : [];
  const latestPickerAnchor = pickerAnchorIndexes.at(-1) ?? null;
  const fallbackPickerAnchor =
    showTicketPicker &&
    lastAgentIndex != null &&
    !pickerAnchorIndexes.includes(lastAgentIndex)
      ? lastAgentIndex
      : null;
  const allPickerAnchors =
    fallbackPickerAnchor != null
      ? [...pickerAnchorIndexes, fallbackPickerAnchor]
      : pickerAnchorIndexes;
  const pickerAnchorSet = new Set(allPickerAnchors);

  const listTurnEvents = findListTurnEvents(payload?.events ?? [], {});
  const latestPickerInteractive =
    latestPickerAnchor != null &&
    isTicketPickerInteractive(messages, latestPickerAnchor);
  const pickerChips =
    listTurnEvents.length > 0
      ? listTurnEvents
      : showTicketPicker || latestPickerInteractive
        ? latestTurnEvents
        : [];

  const detailBlocks = findConsultaDetailBlocks(messages, tickets);
  const latestDetailAfterIndex = detailBlocks.at(-1)?.afterIndex ?? null;

  const pickerItems = openTickets.map((ticket) => ({
    id: ticket.id,
    number: ticket.number,
    title: ticket.title,
    status: formatStatus(ticket.status),
    statusTone: statusTone(ticket.status),
    date: compactDateFor(ticket),
  }));

  function renderPicker(anchorIndex: number) {
    const interactive = isTicketPickerInteractive(messages, anchorIndex);
    const selectedId =
      (interactive ? selectedTicketId : null) ??
      selectedTicketIdForPickerAnchor({
        messages,
        anchorIndex,
        openTickets,
      }) ??
      (interactive && detailTicket ? detailTicket.id : null);
    return (
      <TicketPickerList
        tickets={pickerItems}
        selectedId={selectedId}
        disabled={!interactive || sending || inputLocked}
        onSelect={(ticket) => {
          const row = openTickets.find((t) => t.id === ticket.id);
          if (row) {
            onSelectTicket(row);
          }
        }}
      />
    );
  }

  function renderDetailBlock(
    ticket: TicketRow,
    options: { latest: boolean; events: ExecutionEvent[] },
  ) {
    const ticketOverdue = ticket.dueAt
      ? isTicketOverdue({
          dueAt: new Date(ticket.dueAt),
          status: ticket.status,
        })
      : false;
    const followUp =
      options.latest && showDetailCard && detailTicket?.id === ticket.id
        ? detailCardAgentContent({
            lastAgentMessage,
            overdue: ticketOverdue,
            detailTicket: ticket,
          })
        : ticketOverdue
          ? detailCardAgentContent({
              lastAgentMessage: undefined,
              overdue: true,
              detailTicket: ticket,
            })
          : null;

    return (
      <div className="flex w-full max-w-[600px] flex-col items-start gap-1.5">
        {options.events.length > 0 ? (
          <EventChips events={options.events} className="mb-0" />
        ) : null}
        <TicketCard
          number={ticket.number}
          title={ticket.title}
          description={ticket.description || undefined}
          status={formatStatus(ticket.status)}
          statusTone={statusTone(ticket.status)}
          category={
            ticket.category
              ? formatCategoryLabel(ticket.category, ticket.title)
              : undefined
          }
          priority={formatPriorityPt(ticket.priority)}
          openedAt={
            ticket.createdAt ? formatOpenedAtPt(new Date(ticket.createdAt)) : undefined
          }
          lastUpdate={
            ticket.updatedAt
              ? formatRelativeUpdatePt(new Date(ticket.updatedAt))
              : undefined
          }
          overdue={ticketOverdue}
        />
        {followUp ? (
          <ChatBubble
            role="agent"
            className="max-w-[600px]"
            footer={
              ticketOverdue && options.latest ? (
                <OptionChips
                  disabled={sending || inputLocked}
                  options={[
                    {
                      label: 'Falar com um analista',
                      onClick: () =>
                        onSendContent(
                          `Quero falar com um analista sobre o chamado ${ticket.number}`,
                        ),
                    },
                    {
                      label: 'Adicionar informação',
                      onClick: () =>
                        onSendContent(`Adicionar informação ao chamado ${ticket.number}`),
                    },
                    {
                      label: 'Não, obrigado',
                      onClick: () => onDismissDetail(ticket.number),
                    },
                  ]}
                />
              ) : undefined
            }
          >
            {followUp}
          </ChatBubble>
        ) : null}
      </div>
    );
  }

  return (
    <>
      {messages.length === 0 ? (
        <div className="flex min-h-[min(28rem,calc(100vh-16rem))] w-full flex-1 items-center justify-center px-4">
          <p className="max-w-md text-center text-sm leading-relaxed text-ink-3">
            Nenhuma mensagem ainda. Pergunte sobre VPN, chamados ou abra um novo chamado.
          </p>
        </div>
      ) : null}

      {messages.map((message: Message, index) => {
        const isEmployee = message.role === 'employee';
        const isAnalyst = message.role === 'analyst';
        const isLastAgent = !isEmployee && !isAnalyst && index === lastAgentIndex;
        const isPickerAnchor = pickerAnchorSet.has(index);
        const isLatestPickerAnchor = index === latestPickerAnchor;
        const detailHere = detailBlocks.filter((block) => block.afterIndex === index);
        const detailOwnsThisAgent = detailBlocks.some(
          (block) => block.agentIndex === index,
        );
        const suppressConsultaDump =
          !isEmployee &&
          !isAnalyst &&
          detailOwnsThisAgent &&
          (looksLikeConsultaDetailDump(message.content) ||
            looksLikeOverdueConsultaPrompt(message.content));
        const suppressBubbleForDraft = isLastAgent && Boolean(payload?.draft);
        const showChoices =
          showImpactChoices && index === lastAgentIndex && !isEmployee && !isAnalyst;
        const showGenericChips =
          isLastAgent &&
          !showDetailCard &&
          !payload?.draft &&
          !isPickerAnchor &&
          !showTicketPicker &&
          detailHere.length === 0;

        const agentDisplayContent =
          !isEmployee &&
          !isAnalyst &&
          (looksLikeTicketEnumeration(message.content) ||
            looksLikeTicketListIntro(message.content))
            ? ticketPickerIntroContent(openTickets.length)
            : message.content;

        return (
          <div key={message.id} className="flex flex-col gap-1.5 animate-rise">
            {isPickerAnchor && isLatestPickerAnchor && pickerChips.length > 0 ? (
              <EventChips events={pickerChips} className="mb-0" />
            ) : null}
            {showGenericChips ? <EventChips events={latestTurnEvents} /> : null}

            {suppressConsultaDump || suppressBubbleForDraft ? null : (
              <ChatBubble
                role={isEmployee ? 'employee' : isAnalyst ? 'analyst' : 'agent'}
                className={
                  !isEmployee
                    ? isPickerAnchor
                      ? 'max-w-[600px]'
                      : 'max-w-full'
                    : undefined
                }
                meta={
                  isAnalyst ? (
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-success-text">
                      Analista
                    </p>
                  ) : null
                }
                footer={
                  showChoices ? (
                    <ChoiceOptions
                      disabled={sending || inputLocked}
                      onSelect={(label) => onSendContent(label)}
                    />
                  ) : null
                }
              >
                {isPickerAnchor
                  ? ticketPickerIntroContent(openTickets.length)
                  : agentDisplayContent}
              </ChatBubble>
            )}

            {isPickerAnchor ? renderPicker(index) : null}

            {detailHere.map((block) => (
              <div key={`${block.ticket.id}-${index}`}>
                {renderDetailBlock(block.ticket, {
                  latest:
                    block.afterIndex === latestDetailAfterIndex && showDetailCard,
                  events:
                    block.afterIndex === latestDetailAfterIndex && showDetailCard
                      ? latestTurnEvents
                      : [],
                })}
              </div>
            ))}
          </div>
        );
      })}

      {showTicketPicker && allPickerAnchors.length === 0 ? (
        <div className="flex w-full max-w-[600px] flex-col items-start gap-1.5 animate-rise">
          <EventChips events={latestTurnEvents} className="mb-0" />
          <ChatBubble role="agent" className="max-w-[600px]">
            {ticketPickerIntroContent(openTickets.length)}
          </ChatBubble>
          <TicketPickerList
            tickets={pickerItems}
            selectedId={selectedTicketId}
            disabled={sending || inputLocked}
            onSelect={(ticket) => {
              const row = openTickets.find((t) => t.id === ticket.id);
              if (row) {
                onSelectTicket(row);
              }
            }}
          />
        </div>
      ) : null}

      {/* Fresh inspect turn before selection message is hydrated into history. */}
      {showDetailCard &&
      detailTicket &&
      !detailBlocks.some((block) => block.ticket.id === detailTicket.id) ? (
        <div className="animate-rise">
          {renderDetailBlock(detailTicket, {
            latest: true,
            events: latestTurnEvents,
          })}
        </div>
      ) : null}

      {payload?.draft ? (
        <div className="flex w-full flex-col items-start gap-1.5 animate-rise">
          <EventChips events={latestTurnEvents} className="mb-0" />
          <ChatBubble role="agent" className="max-w-[600px]">
            {lastAgentMessage?.content ??
              'Confira o rascunho antes de eu criar o chamado:'}
          </ChatBubble>
          <DraftConfirmCard
            draft={payload.draft}
            busy={sending}
            onConfirm={() => onConfirmDraft(true)}
            onCancel={() => onConfirmDraft(false)}
            onEdit={() =>
              onEditDraft(String(payload.draft?.payload['title'] ?? ''))
            }
          />
        </div>
      ) : null}

      {sending || pendingExecutionId ? (
        <p className="animate-pulse-soft text-sm text-ink-3">Processando…</p>
      ) : null}
      {incompleteHint ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg bg-warning-soft px-3 py-2 text-sm text-warning-text">
          <span>{incompleteHint}</span>
          {retryContent ? (
            <button
              type="button"
              className="font-semibold underline"
              onClick={onRetryIncomplete}
            >
              Tentar novamente
            </button>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
