'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  buildOverdueConsultaPrompt,
  formatCategoryLabel,
  formatOpenedAtPt,
  formatPriorityPt,
  formatRelativeUpdatePt,
  formatShortDatePt,
  isTicketOverdue,
} from '@nexo-assist/domain';
import {
  api,
  ApiError,
  type ConversationPayload,
  type ExecutionEvent,
  type Message,
  type User,
} from '@/lib/api';
import { AppShell } from '@/components/AppShell';
import { Button } from '@/components/Button';
import { ChatBubble } from '@/components/ChatBubble';
import { ChoiceOptions, messageAsksImpact } from '@/components/ChoiceOptions';
import { DraftConfirmCard } from '@/components/DraftConfirmCard';
import { EventChips } from '@/components/EventChips';
import { StatusPill } from '@/components/StatusPill';
import { OptionChips } from '@/components/OptionChips';
import { TicketCard } from '@/components/TicketCard';
import { TicketPickerList } from '@/components/TicketPickerList';
import { ArrowUpIcon, ChevronDownIcon } from '@/components/icons';

const NEAR_BOTTOM_PX = 100;

type TicketRow = {
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

function statusTone(status: string): 'success' | 'warning' | 'danger' | 'neutral' | 'primary' {
  const value = status.toLowerCase();
  if (value.includes('resolv') || value.includes('aprov')) return 'success';
  if (value.includes('progress') || value.includes('andamento')) return 'primary';
  if (value.includes('wait') || value.includes('aguard')) return 'warning';
  return 'neutral';
}

function formatStatus(status: string): string {
  const map: Record<string, string> = {
    waiting_analyst: 'Aguardando analista',
    in_progress: 'Em andamento',
    approved: 'Aprovado',
    resolved: 'Resolvido',
    open: 'Aberto',
  };
  return map[status] ?? status.replaceAll('_', ' ');
}

function mapTickets(ticketRows: Array<Record<string, unknown>>): TicketRow[] {
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
function turnListedTickets(events: ExecutionEvent[]): boolean {
  return events.some((event) => event.tool === 'list_my_tickets');
}

function turnInspectedTicketNumber(events: ExecutionEvent[]): string | null {
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

function isOpenTicket(status: string): boolean {
  return status !== 'resolved';
}

function compactDateFor(ticket: TicketRow): string | undefined {
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

export default function ChatPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [payload, setPayload] = useState<ConversationPayload | null>(null);
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [dismissedDetailNumber, setDismissedDetailNumber] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [turnEvents, setTurnEvents] = useState<Record<string, ExecutionEvent[]>>({});
  const [showNewMessageCue, setShowNewMessageCue] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const threadContentRef = useRef<HTMLDivElement>(null);
  const nearBottomRef = useRef(true);
  const stickToBottomRef = useRef(true);
  const prevMessageCountRef = useRef(0);
  const prevScrollHeightRef = useRef(0);

  function isNearBottom(el: HTMLDivElement): boolean {
    return el.scrollHeight - el.scrollTop - el.clientHeight <= NEAR_BOTTOM_PX;
  }

  function scrollToBottom(behavior: ScrollBehavior = 'smooth') {
    const el = scrollRef.current;
    if (!el) {
      return;
    }
    el.scrollTo({ top: el.scrollHeight, behavior });
    nearBottomRef.current = true;
    stickToBottomRef.current = true;
    setShowNewMessageCue(false);
  }

  function onThreadScroll() {
    const el = scrollRef.current;
    if (!el) {
      return;
    }
    const near = isNearBottom(el);
    nearBottomRef.current = near;
    stickToBottomRef.current = near;
    if (near) {
      setShowNewMessageCue(false);
    }
  }

  useEffect(() => {
    void (async () => {
      try {
        const me = await api.me();
        if (me.user.role === 'analyst') {
          router.replace('/console');
          return;
        }
        setUser(me.user);
        const [conversation, ticketRows] = await Promise.all([
          api.currentConversation(),
          api.listTickets(),
        ]);
        setPayload(conversation);
        setTickets(mapTickets(ticketRows));
        const grouped: Record<string, ExecutionEvent[]> = {};
        for (const event of conversation.events) {
          const key = event.executionId;
          grouped[key] = [...(grouped[key] ?? []), event];
        }
        setTurnEvents(grouped);
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          router.replace('/login');
          return;
        }
        setError(err instanceof Error ? err.message : 'Falha ao carregar o chat');
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  const paused = useMemo(() => {
    const status = payload?.conversation?.status;
    return status === 'waiting_analyst' || status === 'with_analyst' || status === 'closed';
  }, [payload]);

  const threadFingerprint = useMemo(() => {
    if (!payload) {
      return 'empty';
    }
    const lastMessage = payload.messages.at(-1);
    const lastEvent = payload.events.at(-1);
    return [
      payload.messages.length,
      lastMessage?.id ?? '',
      payload.draft?.id ?? '',
      lastEvent?.executionId ?? '',
      tickets.length,
      sending ? 'sending' : 'idle',
    ].join('|');
  }, [payload, sending, tickets.length]);

  // Keep the viewport glued to the bottom while stick/near-bottom; otherwise cue
  // when the thread grows (messages, ticket list, draft card, etc.).
  useEffect(() => {
    if (loading) {
      return;
    }
    const scroller = scrollRef.current;
    const content = threadContentRef.current;
    if (!scroller || !content) {
      return;
    }

    prevScrollHeightRef.current = scroller.scrollHeight;

    const syncToGrowth = () => {
      const nextHeight = scroller.scrollHeight;
      const grew = nextHeight > prevScrollHeightRef.current + 1;
      prevScrollHeightRef.current = nextHeight;
      if (!grew) {
        return;
      }
      if (stickToBottomRef.current || nearBottomRef.current) {
        scroller.scrollTop = scroller.scrollHeight;
        nearBottomRef.current = true;
        stickToBottomRef.current = true;
        setShowNewMessageCue(false);
        return;
      }
      setShowNewMessageCue(true);
    };

    const observer = new ResizeObserver(() => {
      syncToGrowth();
    });
    observer.observe(content);
    return () => observer.disconnect();
  }, [loading, user]);

  useEffect(() => {
    if (loading || !payload) {
      return;
    }
    const messageCount = payload.messages.length;
    const previousCount = prevMessageCountRef.current;
    const grew = messageCount > previousCount;
    prevMessageCountRef.current = messageCount;

    const shouldStick = stickToBottomRef.current || nearBottomRef.current;
    if (shouldStick) {
      const behavior: ScrollBehavior =
        previousCount === 0 ? 'auto' : 'smooth';
      const frame = window.requestAnimationFrame(() => {
        scrollToBottom(behavior);
      });
      return () => window.cancelAnimationFrame(frame);
    }

    if (grew) {
      setShowNewMessageCue(true);
    }
  }, [threadFingerprint, loading, payload]);

  async function refresh() {
    const conversation = await api.currentConversation();
    setPayload(conversation);
    const grouped: Record<string, ExecutionEvent[]> = {};
    for (const event of conversation.events) {
      const key = event.executionId;
      grouped[key] = [...(grouped[key] ?? []), event];
    }
    setTurnEvents(grouped);
  }

  async function reloadTickets() {
    setTickets(mapTickets(await api.listTickets()));
  }

  async function sendContent(content: string) {
    if (!content.trim() || sending || paused) {
      return;
    }
    stickToBottomRef.current = true;
    setShowNewMessageCue(false);
    setSending(true);
    setError(null);
    setInput('');
    setSelectedTicketId(null);
    setDismissedDetailNumber(null);
    try {
      const result = await api.sendMessage(content.trim());
      setTurnEvents((prev) => ({
        ...prev,
        [result.events[0]?.executionId ?? crypto.randomUUID()]: result.events,
      }));
      await refresh();
      await reloadTickets();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Falha ao enviar mensagem');
    } finally {
      setSending(false);
    }
  }

  async function onSend(event: FormEvent) {
    event.preventDefault();
    await sendContent(input);
  }

  async function onConfirmDraft(confirm: boolean) {
    if (!payload?.draft) {
      return;
    }
    stickToBottomRef.current = true;
    setShowNewMessageCue(false);
    setSending(true);
    try {
      await api.confirmDraft(payload.draft.id, payload.draft.version, confirm);
      await refresh();
      await reloadTickets();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Falha ao confirmar rascunho');
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-ink-2">
        <p className="animate-pulse-soft">Carregando atendimento…</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <p className="rounded-xl bg-danger-soft px-4 py-3 text-danger-text">
          {error ?? 'Não foi possível carregar o atendimento.'}
        </p>
      </div>
    );
  }

  const count = payload?.conversation?.employeeMessageCount ?? 0;
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
    !paused &&
    !payload?.draft &&
    Boolean(lastAgentMessage && messageAsksImpact(lastAgentMessage.content));
  // Ticket cards only for status/list turns (Figma consulta). Create flow may call
  // list_my_tickets for transparency chips but must not dump the inbox into the thread.
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

  return (
    <AppShell
      user={user}
      breadcrumb="Atendimento"
      status={
        <StatusPill
          label={paused ? 'Agente pausado' : 'Assistente online'}
          tone={paused ? 'warning' : 'success'}
          dot
        />
      }
    >
      <div className="flex h-full min-h-0 flex-1 flex-col">
        <div className="relative mx-auto flex h-full min-h-0 w-full max-w-4xl flex-1 flex-col px-6 pt-7 lg:px-12">
          <div
            ref={scrollRef}
            onScroll={onThreadScroll}
            className="scrollbar-none min-h-0 flex-1 overflow-y-auto pb-4"
          >
            <div ref={threadContentRef} className="flex min-h-0 flex-col space-y-5">
            {messages.length === 0 ? (
              <p className="text-sm text-ink-3">
                Nenhuma mensagem ainda. Pergunte sobre VPN, chamados ou abra um novo chamado.
              </p>
            ) : null}

            {messages.map((message: Message, index) => {
              const isEmployee = message.role === 'employee';
              const isAnalyst = message.role === 'analyst';
              const isLastAgent = !isEmployee && !isAnalyst && index === lastAgentIndex;
              // Prototype: chips+card grouped outside the message bubble for draft/consulta detail.
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
                            disabled={sending || paused}
                            onSelect={(label) => void sendContent(label)}
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
                disabled={sending || paused}
                onSelect={(ticket) => {
                  setSelectedTicketId(ticket.id);
                  void sendContent(`${ticket.number} · ${ticket.title}`);
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
                        disabled={sending || paused}
                        options={[
                          {
                            label: 'Falar com um analista',
                            onClick: () =>
                              void sendContent(
                                `Quero falar com um analista sobre o chamado ${detailTicket.number}`,
                              ),
                          },
                          {
                            label: 'Adicionar informação',
                            onClick: () =>
                              void sendContent(
                                `Adicionar informação ao chamado ${detailTicket.number}`,
                              ),
                          },
                          {
                            label: 'Não, obrigado',
                            onClick: () => {
                              setSelectedTicketId(null);
                              setDismissedDetailNumber(detailTicket.number);
                            },
                          },
                        ]}
                      />
                    ) : undefined
                  }
                >
                  {lastAgentMessage?.content ??
                    (overdue && detailTicket.updatedAt
                      ? buildOverdueConsultaPrompt({
                          updatedAt: new Date(detailTicket.updatedAt),
                        })
                      : 'Consultei o chamado selecionado.')}
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
                  onConfirm={() => void onConfirmDraft(true)}
                  onCancel={() => void onConfirmDraft(false)}
                  onEdit={() =>
                    setInput(
                      `Quero editar o rascunho: ${String(payload.draft?.payload['title'] ?? '')}`,
                    )
                  }
                />
              </div>
            ) : null}

            {sending ? (
              <p className="animate-pulse-soft text-sm text-ink-3">Processando…</p>
            ) : null}
            </div>
          </div>

          {showNewMessageCue ? (
            <button
              type="button"
              onClick={() => scrollToBottom('smooth')}
              className="absolute bottom-[92px] left-1/2 z-10 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-rule bg-paper px-3.5 py-2 text-[13px] font-semibold text-primary-text shadow-[0_8px_24px_rgba(27,36,49,0.14)] animate-rise transition hover:border-primary hover:bg-primary-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
              aria-label="Ir para a nova mensagem"
            >
              Nova mensagem
              <ChevronDownIcon width={14} height={14} />
            </button>
          ) : null}

          {error ? (
            <p className="mb-3 shrink-0 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger-text">
              {error}
            </p>
          ) : null}

          <form onSubmit={onSend} className="shrink-0 space-y-1.5 pb-[18px] pt-2.5">
            <div className="flex h-12 items-center gap-x-2 rounded-xl border border-[rgba(27,36,49,0.12)] bg-paper py-0 pl-4 pr-1.5 focus-within:border-cta">
              <input
                className="min-w-0 flex-1 bg-transparent text-[14.5px] text-ink outline-none placeholder:text-ink-3 disabled:opacity-50"
                placeholder={
                  paused ? 'Agente pausado — aguarde o analista' : 'Escreva para o Nexo…'
                }
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={paused || sending}
                maxLength={4000}
                aria-label="Mensagem"
              />
              <Button
                type="submit"
                disabled={paused || sending || !input.trim()}
                className="h-9 shrink-0 gap-1.5 rounded-md px-3 text-[13.5px]"
              >
                <ArrowUpIcon className="text-white" width={14} height={14} />
                Enviar
              </Button>
            </div>
            <p className="text-right text-xs text-ink-3">
              {count}/30 mensagens nesta sessão
            </p>
          </form>
        </div>
      </div>
    </AppShell>
  );
}
