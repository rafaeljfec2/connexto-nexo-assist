import {
  formatCategoryLabel,
  formatOpenedAtPt,
  formatPriorityPt,
  formatRelativeUpdatePt,
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
import { detailCardAgentContent } from './chat-thread-derivations';

export type ChatThreadViewProps = {
  messages: Message[];
  payload: ConversationPayload | null;
  lastAgentIndex: number | undefined;
  latestTurnEvents: ExecutionEvent[];
  showDetailCard: boolean;
  showImpactChoices: boolean;
  showTicketPicker: boolean;
  openTickets: TicketRow[];
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

  return (
    <>
      {messages.length === 0 ? (
        <p className="text-sm text-ink-3">
          Nenhuma mensagem ainda. Pergunte sobre VPN, chamados ou abra um novo chamado.
        </p>
      ) : null}

      {messages.map((message: Message, index) => {
        const isEmployee = message.role === 'employee';
        const isAnalyst = message.role === 'analyst';
        const isLastAgent = !isEmployee && !isAnalyst && index === lastAgentIndex;
        const suppressBubbleForDetail = isLastAgent && showDetailCard;
        const suppressBubbleForDraft = isLastAgent && Boolean(payload?.draft);
        const showChips =
          isLastAgent && !showDetailCard && !payload?.draft;
        const showChoices =
          showImpactChoices && index === lastAgentIndex && !isEmployee && !isAnalyst;
        return (
          <div
            key={message.id}
            className={showChips ? 'flex flex-col animate-rise' : 'animate-rise'}
          >
            {showChips ? <EventChips events={latestTurnEvents} /> : null}
            {suppressBubbleForDetail || suppressBubbleForDraft ? null : (
              <ChatBubble
                role={isEmployee ? 'employee' : isAnalyst ? 'analyst' : 'agent'}
                className={!isEmployee ? 'max-w-full' : undefined}
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
                {message.content}
              </ChatBubble>
            )}
          </div>
        );
      })}

      {showTicketPicker ? (
        <TicketPickerList
          tickets={openTickets.map((ticket) => ({
            id: ticket.id,
            number: ticket.number,
            title: ticket.title,
            status: formatStatus(ticket.status),
            statusTone: statusTone(ticket.status),
            date: compactDateFor(ticket),
          }))}
          selectedId={selectedTicketId}
          disabled={sending || inputLocked}
          onSelect={(ticket) => {
            const row = openTickets.find((t) => t.id === ticket.id);
            if (row) {
              onSelectTicket(row);
            }
          }}
        />
      ) : null}

      {showDetailCard && detailTicket ? (
        <div className="flex w-full max-w-full flex-col items-start gap-1.5 animate-rise">
          <EventChips events={latestTurnEvents} className="mb-0" />
          <TicketCard
            number={detailTicket.number}
            title={detailTicket.title}
            description={detailTicket.description || undefined}
            status={formatStatus(detailTicket.status)}
            statusTone={statusTone(detailTicket.status)}
            category={
              detailTicket.category
                ? formatCategoryLabel(detailTicket.category, detailTicket.title)
                : undefined
            }
            priority={formatPriorityPt(detailTicket.priority)}
            openedAt={
              detailTicket.createdAt
                ? formatOpenedAtPt(new Date(detailTicket.createdAt))
                : undefined
            }
            lastUpdate={
              detailTicket.updatedAt
                ? formatRelativeUpdatePt(new Date(detailTicket.updatedAt))
                : undefined
            }
            overdue={Boolean(overdue)}
          />
          <ChatBubble
            role="agent"
            className="max-w-[600px]"
            footer={
              overdue ? (
                <OptionChips
                  disabled={sending || inputLocked}
                  options={[
                    {
                      label: 'Falar com um analista',
                      onClick: () =>
                        onSendContent(
                          `Quero falar com um analista sobre o chamado ${detailTicket.number}`,
                        ),
                    },
                    {
                      label: 'Adicionar informação',
                      onClick: () =>
                        onSendContent(
                          `Adicionar informação ao chamado ${detailTicket.number}`,
                        ),
                    },
                    {
                      label: 'Não, obrigado',
                      onClick: () => onDismissDetail(detailTicket.number),
                    },
                  ]}
                />
              ) : undefined
            }
          >
            {detailCardAgentContent({ lastAgentMessage, overdue, detailTicket })}
          </ChatBubble>
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
