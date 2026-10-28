'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  api,
  ApiError,
  type ConversationPayload,
  type ExecutionEvent,
  type User,
} from '@/lib/api';
import { AppShell } from '@/components/AppShell';
import { StatusPill } from '@/components/StatusPill';
import { groupEventsByExecution, mapTickets, type TicketRow } from './chat-helpers';
import { deriveChatThreadUi } from './chat-thread-derivations';
import { ChatComposer } from './chat-composer';
import { ChatThreadView } from './chat-thread-view';
import { useChatMessaging } from './use-chat-messaging';
import { useChatScroll } from './use-chat-scroll';
import { useChatSse } from './use-chat-sse';

export default function ChatPage() {
  const router = useRouter();
  const stickToBottomRef = useRef(true);
  const setShowNewMessageCueRef = useRef<(value: boolean) => void>(() => {});

  const [user, setUser] = useState<User | null>(null);
  const [payload, setPayload] = useState<ConversationPayload | null>(null);
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [dismissedDetailNumber, setDismissedDetailNumber] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [turnEvents, setTurnEvents] = useState<Record<string, ExecutionEvent[]>>({});
  const [loadError, setLoadError] = useState<string | null>(null);

  const status = payload?.conversation?.status;
  const withAnalyst = status === 'with_analyst';
  const agentPaused = useMemo(() => {
    return status === 'waiting_analyst' || status === 'with_analyst' || status === 'closed';
  }, [status]);
  const inputLocked = useMemo(() => {
    return status === 'waiting_analyst' || status === 'closed';
  }, [status]);

  const messaging = useChatMessaging({
    payload,
    inputLocked,
    stickToBottomRef,
    setShowNewMessageCue: (value) => setShowNewMessageCueRef.current(value),
    setPayload,
    setTurnEvents,
    setTickets,
    setInput,
    onSendStart: () => {
      setSelectedTicketId(null);
      setDismissedDetailNumber(null);
    },
  });

  const {
    sending,
    error,
    incompleteHint,
    retryContent,
    pendingExecutionId,
    pendingExecutionRef,
    clearTurnTimer,
    onAgentIncompleteOrFailed,
    onAgentCompleted,
    refresh,
    reloadTickets,
    sendContent,
    retryIncompleteTurn,
    onConfirmDraft,
  } = messaging;

  const {
    scrollRef,
    threadContentRef,
    showNewMessageCue,
    setShowNewMessageCue,
    scrollToBottom,
    onThreadScroll,
  } = useChatScroll({
    loading,
    user,
    payload,
    sending,
    ticketsLength: tickets.length,
    stickToBottomRef,
  });

  useEffect(() => {
    setShowNewMessageCueRef.current = setShowNewMessageCue;
  }, [setShowNewMessageCue]);

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
        setTurnEvents(groupEventsByExecution(conversation.events));
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          router.replace('/login');
          return;
        }
        setLoadError(err instanceof Error ? err.message : 'Falha ao carregar o chat');
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  useChatSse(
    payload?.conversation?.id,
    payload?.conversation?.lastEventSeq ?? 0,
    pendingExecutionRef,
    {
      clearTurnTimer,
      onAgentIncompleteOrFailed,
      onAgentCompleted,
      refresh,
      reloadTickets,
    },
  );

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
          {loadError ?? 'Não foi possível carregar o atendimento.'}
        </p>
      </div>
    );
  }

  const thread = deriveChatThreadUi({
    payload,
    tickets,
    turnEvents,
    agentPaused,
    dismissedDetailNumber,
  });

  const count = payload?.conversation?.employeeMessageCount ?? 0;

  async function onSend(event: FormEvent) {
    event.preventDefault();
    await sendContent(input);
  }

  return (
    <AppShell
      user={user}
      breadcrumb="Atendimento"
      status={
        <StatusPill
          label={
            withAnalyst
              ? 'Em atendimento humano'
              : agentPaused
                ? 'Agente pausado'
                : 'Assistente online'
          }
          tone={withAnalyst ? 'primary' : agentPaused ? 'warning' : 'success'}
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
              <ChatThreadView
                messages={thread.messages}
                payload={payload}
                lastAgentIndex={thread.lastAgentIndex}
                latestTurnEvents={thread.latestTurnEvents}
                showDetailCard={thread.showDetailCard}
                showImpactChoices={thread.showImpactChoices}
                showTicketPicker={thread.showTicketPicker}
                openTickets={thread.openTickets}
                detailTicket={thread.detailTicket}
                overdue={thread.overdue}
                lastAgentMessage={thread.lastAgentMessage}
                selectedTicketId={selectedTicketId}
                sending={sending}
                inputLocked={inputLocked}
                pendingExecutionId={pendingExecutionId}
                incompleteHint={incompleteHint}
                retryContent={retryContent}
                onSendContent={(content) => void sendContent(content)}
                onRetryIncomplete={() => void retryIncompleteTurn()}
                onSelectTicket={(ticket) => {
                  setSelectedTicketId(ticket.id);
                  void sendContent(`${ticket.number} · ${ticket.title}`);
                }}
                onDismissDetail={(ticketNumber) => {
                  setSelectedTicketId(null);
                  setDismissedDetailNumber(ticketNumber);
                }}
                onConfirmDraft={(confirm) => void onConfirmDraft(confirm)}
                onEditDraft={(title) =>
                  setInput(`Quero editar o rascunho: ${title}`)
                }
              />
            </div>
          </div>

          <ChatComposer
            status={status}
            withAnalyst={withAnalyst}
            input={input}
            inputLocked={inputLocked}
            sending={sending}
            count={count}
            error={error}
            retryContent={retryContent}
            showNewMessageCue={showNewMessageCue}
            onInputChange={setInput}
            onSubmit={onSend}
            onScrollToBottom={() => scrollToBottom('smooth')}
            onRetry={() => void retryIncompleteTurn()}
          />
        </div>
      </div>
    </AppShell>
  );
}
