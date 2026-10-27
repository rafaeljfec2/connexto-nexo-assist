'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
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
import { EventChips } from '@/components/EventChips';
import { StatusPill } from '@/components/StatusPill';
import { TicketCard } from '@/components/TicketCard';
import { SendIcon } from '@/components/icons';

type TicketRow = {
  id: string;
  number: string;
  title: string;
  status: string;
  priority: string;
  category: string;
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

export default function ChatPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [payload, setPayload] = useState<ConversationPayload | null>(null);
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [turnEvents, setTurnEvents] = useState<Record<string, ExecutionEvent[]>>({});

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
        setTickets(
          ticketRows.map((t) => ({
            id: String(t['id']),
            number: String(t['number']),
            title: String(t['title']),
            status: String(t['status']),
            priority: String(t['priority']),
            category: String(t['category'] ?? t['Category'] ?? ''),
            dueAt: String(t['dueAt'] ?? t['due_at'] ?? ''),
            createdAt: String(t['createdAt'] ?? t['created_at'] ?? ''),
            updatedAt: String(t['updatedAt'] ?? t['updated_at'] ?? ''),
          })),
        );
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

  const selectedTicket = tickets.find((t) => t.id === selectedTicketId) ?? null;
  const overdue =
    selectedTicket && selectedTicket.dueAt
      ? new Date(selectedTicket.dueAt).getTime() < Date.now() &&
        selectedTicket.status !== 'resolved'
      : false;

  async function refresh() {
    const conversation = await api.currentConversation();
    setPayload(conversation);
  }

  async function reloadTickets() {
    const ticketRows = await api.listTickets();
    setTickets(
      ticketRows.map((t) => ({
        id: String(t['id']),
        number: String(t['number']),
        title: String(t['title']),
        status: String(t['status']),
        priority: String(t['priority']),
        category: String(t['category'] ?? t['Category'] ?? ''),
        dueAt: String(t['dueAt'] ?? t['due_at'] ?? ''),
        createdAt: String(t['createdAt'] ?? t['created_at'] ?? ''),
        updatedAt: String(t['updatedAt'] ?? t['updated_at'] ?? ''),
      })),
    );
  }

  async function onSend(event: FormEvent) {
    event.preventDefault();
    if (!input.trim() || sending || paused) {
      return;
    }
    setSending(true);
    setError(null);
    const content = input.trim();
    setInput('');
    try {
      const result = await api.sendMessage(content);
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

  async function onConfirmDraft(confirm: boolean) {
    if (!payload?.draft) {
      return;
    }
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
  const lastAgentIndex = [...messages]
    .map((m, i) => ({ m, i }))
    .reverse()
    .find(({ m }) => m.role === 'agent' || m.role === 'assistant')?.i;
  const latestTurnEvents = Object.values(turnEvents).at(-1) ?? (payload?.events ?? []).slice(-4);

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
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 py-7 lg:px-12">
          <div className="flex-1 space-y-5 overflow-y-auto pb-4">
            {messages.length === 0 ? (
              <p className="text-sm text-ink-3">
                Nenhuma mensagem ainda. Pergunte sobre VPN, chamados ou abra um novo chamado.
              </p>
            ) : null}

            {messages.map((message: Message, index) => {
              const isEmployee = message.role === 'employee';
              const isAnalyst = message.role === 'analyst';
              const showChips = !isEmployee && !isAnalyst && index === lastAgentIndex;
              return (
                <div key={message.id} className="animate-rise">
                  {showChips ? <EventChips events={latestTurnEvents} /> : null}
                  <ChatBubble
                    role={isEmployee ? 'employee' : isAnalyst ? 'analyst' : 'agent'}
                    meta={
                      isAnalyst ? (
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-success-text">
                          Analista
                        </p>
                      ) : null
                    }
                  >
                    {message.content}
                  </ChatBubble>
                </div>
              );
            })}

            {tickets.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs font-medium text-ink-3">Seus chamados</p>
                {tickets.map((ticket) => (
                  <TicketCard
                    key={ticket.id}
                    compact
                    number={ticket.number}
                    title={ticket.title}
                    status={formatStatus(ticket.status)}
                    statusTone={statusTone(ticket.status)}
                    selected={selectedTicketId === ticket.id}
                    onSelect={() => setSelectedTicketId(ticket.id)}
                    className="bg-paper"
                  />
                ))}
              </div>
            ) : null}

            {selectedTicket ? (
              <TicketCard
                number={selectedTicket.number}
                title={selectedTicket.title}
                status={formatStatus(selectedTicket.status)}
                statusTone={statusTone(selectedTicket.status)}
                category={selectedTicket.category || undefined}
                priority={selectedTicket.priority}
                openedAt={
                  selectedTicket.createdAt
                    ? new Date(selectedTicket.createdAt).toLocaleString('pt-BR')
                    : undefined
                }
                lastUpdate={
                  selectedTicket.dueAt
                    ? `prazo ${new Date(selectedTicket.dueAt).toLocaleString('pt-BR')}`
                    : undefined
                }
                overdue={Boolean(overdue)}
                actions={
                  overdue
                    ? [
                        {
                          label: 'Falar com um analista',
                          variant: 'secondary',
                          onClick: () =>
                            setInput('Quero falar com um analista sobre o chamado atrasado'),
                        },
                        {
                          label: 'Adicionar informação',
                          variant: 'secondary',
                          onClick: () =>
                            setInput(`Adicionar informação ao chamado ${selectedTicket.number}: `),
                        },
                        {
                          label: 'Não, obrigado',
                          variant: 'ghost',
                          onClick: () => setSelectedTicketId(null),
                        },
                      ]
                    : undefined
                }
              />
            ) : null}

            {payload?.draft ? (
              <div className="rounded-xl border border-rule bg-desk p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-medium text-ink-3">Novo chamado</span>
                  <span className="text-xs text-ink-3">Rascunho D-{payload.draft.version}</span>
                  <StatusPill label="Aguardando confirmação" tone="warning" />
                </div>
                <p className="mt-2 text-lg font-semibold text-ink">{payload.draft.action}</p>
                <pre className="mt-2 overflow-x-auto rounded-lg bg-paper p-3 text-xs text-ink-2">
                  {JSON.stringify(payload.draft.payload, null, 2)}
                </pre>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    disabled={sending}
                    onClick={() => void onConfirmDraft(true)}
                    className="h-9"
                  >
                    Confirmar
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={sending}
                    onClick={() => void onConfirmDraft(false)}
                    className="h-9"
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : null}

            {sending ? (
              <p className="animate-pulse-soft text-sm text-ink-3">Processando…</p>
            ) : null}
          </div>

          {error ? (
            <p className="mb-3 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger-text">
              {error}
            </p>
          ) : null}

          <form onSubmit={onSend} className="space-y-2 border-t border-rule pt-3">
            <div className="mb-1 flex flex-wrap gap-2">
              {['VPN erro 809', 'Status dos meus chamados', 'Quero falar com um analista'].map(
                (chip) => (
                  <button
                    key={chip}
                    type="button"
                    className="rounded-full bg-desk px-3 py-1 text-xs text-ink-2 hover:bg-mist-100 disabled:opacity-50"
                    onClick={() => setInput(chip)}
                    disabled={paused}
                  >
                    {chip}
                  </button>
                ),
              )}
            </div>
            <div className="flex items-center gap-3">
              <input
                className="h-11 flex-1 rounded-xl border border-rule bg-desk px-3.5 text-[14.5px] text-ink outline-none placeholder:text-ink-3 focus:border-cta focus:bg-paper disabled:opacity-50"
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
                className="h-11 w-11 shrink-0 rounded-full px-0"
                aria-label="Enviar"
              >
                <SendIcon className="text-white" />
              </Button>
            </div>
            <p className="text-xs text-ink-3">{count}/30 mensagens nesta sessão</p>
          </form>
        </div>
      </div>
    </AppShell>
  );
}
