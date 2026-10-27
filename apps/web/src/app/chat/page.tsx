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
import { EventChips } from '@/components/EventChips';

type TicketRow = {
  id: string;
  number: string;
  title: string;
  status: string;
  priority: string;
  dueAt: string;
};

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
            dueAt: String(t['dueAt'] ?? t['due_at'] ?? ''),
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
      const ticketRows = await api.listTickets();
      setTickets(
        ticketRows.map((t) => ({
          id: String(t['id']),
          number: String(t['number']),
          title: String(t['title']),
          status: String(t['status']),
          priority: String(t['priority']),
          dueAt: String(t['dueAt'] ?? t['due_at'] ?? ''),
        })),
      );
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
      const ticketRows = await api.listTickets();
      setTickets(
        ticketRows.map((t) => ({
          id: String(t['id']),
          number: String(t['number']),
          title: String(t['title']),
          status: String(t['status']),
          priority: String(t['priority']),
          dueAt: String(t['dueAt'] ?? t['due_at'] ?? ''),
        })),
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Falha ao confirmar rascunho');
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-navy-700">
        <p className="animate-pulse-soft">Carregando atendimento…</p>
      </div>
    );
  }

  const count = payload?.conversation?.employeeMessageCount ?? 0;

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[240px_1fr]">
      <aside className="border-r border-mist-200 bg-white/80 px-5 py-6 backdrop-blur">
        <p className="text-xs uppercase tracking-[0.2em] text-navy-700/60">Nexo</p>
        <h1 className="mt-2 font-display text-2xl text-navy-900">Assist</h1>
        <p className="mt-6 text-sm text-navy-700">{user?.name}</p>
        <p className="text-xs text-navy-700/60">{user?.area}</p>
        <button
          type="button"
          className="mt-8 text-sm text-accent"
          onClick={async () => {
            await api.logout();
            router.replace('/login');
          }}
        >
          Sair
        </button>
      </aside>

      <main className="flex min-h-screen flex-col">
        <header className="border-b border-mist-200 bg-white/70 px-6 py-4 backdrop-blur">
          <p className="text-sm text-navy-700/70">Service desk de TI / Atendimento</p>
          <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-2xl text-navy-900">Conversa com o assistente</h2>
            <div className="flex items-center gap-3 text-sm">
              <span
                className={`rounded-full px-3 py-1 ${
                  paused ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                }`}
              >
                {paused ? 'Agente pausado' : 'Agente disponível'}
              </span>
              <span className="text-navy-700">
                {count}/30
              </span>
            </div>
          </div>
        </header>

        <div className="grid flex-1 gap-4 p-4 lg:grid-cols-[1fr_320px]">
          <section className="flex flex-col rounded-3xl bg-white shadow-panel">
            <div className="flex-1 space-y-4 overflow-y-auto p-5">
              {(payload?.messages ?? []).length === 0 ? (
                <p className="text-sm text-navy-700/70">
                  Nenhuma mensagem ainda. Pergunte sobre VPN, chamados ou abra um novo chamado.
                </p>
              ) : null}

              {(payload?.messages ?? []).map((message: Message) => {
                const isEmployee = message.role === 'employee';
                const relatedEvents = Object.values(turnEvents)
                  .flat()
                  .filter(() => message.role === 'agent');
                return (
                  <div
                    key={message.id}
                    className={`max-w-[85%] animate-rise ${isEmployee ? 'ml-auto' : ''}`}
                  >
                    {!isEmployee ? (
                      <EventChips
                        events={
                          relatedEvents.length > 0
                            ? relatedEvents.slice(-4)
                            : (payload?.events ?? []).slice(-4)
                        }
                      />
                    ) : null}
                    <div
                      className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                        isEmployee
                          ? 'bg-navy-900 text-white'
                          : message.role === 'analyst'
                            ? 'bg-amber-50 text-navy-900'
                            : 'bg-mist-100 text-navy-900'
                      }`}
                    >
                      {message.role === 'analyst' ? (
                        <p className="mb-1 text-[11px] uppercase tracking-wide text-amber-700">
                          Analista
                        </p>
                      ) : null}
                      {message.content}
                    </div>
                  </div>
                );
              })}

              {sending ? (
                <p className="animate-pulse-soft text-sm text-navy-700/70">Processando…</p>
              ) : null}
            </div>

            {payload?.draft ? (
              <div className="border-t border-mist-200 bg-accent-soft px-5 py-4">
                <p className="text-sm font-semibold text-navy-900">
                  Rascunho v{payload.draft.version} · {payload.draft.action}
                </p>
                <pre className="mt-2 overflow-x-auto rounded-xl bg-white/80 p-3 text-xs text-navy-800">
                  {JSON.stringify(payload.draft.payload, null, 2)}
                </pre>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    disabled={sending}
                    onClick={() => void onConfirmDraft(true)}
                    className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white"
                  >
                    Confirmar
                  </button>
                  <button
                    type="button"
                    disabled={sending}
                    onClick={() => void onConfirmDraft(false)}
                    className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-navy-800"
                  >
                    Rejeitar
                  </button>
                </div>
              </div>
            ) : null}

            {error ? (
              <p className="mx-5 mb-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            ) : null}

            <form onSubmit={onSend} className="border-t border-mist-200 p-4">
              <div className="mb-3 flex flex-wrap gap-2">
                {['VPN erro 809', 'Status dos meus chamados', 'Quero falar com um analista'].map(
                  (chip) => (
                    <button
                      key={chip}
                      type="button"
                      className="rounded-full bg-mist-100 px-3 py-1 text-xs text-navy-800"
                      onClick={() => setInput(chip)}
                      disabled={paused}
                    >
                      {chip}
                    </button>
                  ),
                )}
              </div>
              <div className="flex gap-2">
                <input
                  className="flex-1 rounded-xl border border-mist-200 bg-mist-50 px-4 py-3 text-sm outline-none focus:border-accent disabled:opacity-50"
                  placeholder={
                    paused
                      ? 'Agente pausado — aguarde o analista'
                      : 'Descreva seu problema de TI…'
                  }
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  disabled={paused || sending}
                  maxLength={4000}
                />
                <button
                  type="submit"
                  disabled={paused || sending || !input.trim()}
                  className="rounded-xl bg-navy-900 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
                >
                  Enviar
                </button>
              </div>
            </form>
          </section>

          <aside className="space-y-4">
            <div className="rounded-3xl bg-white p-4 shadow-panel">
              <h3 className="font-display text-lg text-navy-900">Seus chamados</h3>
              {tickets.length === 0 ? (
                <p className="mt-3 text-sm text-navy-700/70">Nenhum chamado encontrado.</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {tickets.map((ticket) => (
                    <li key={ticket.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedTicketId(ticket.id)}
                        className={`w-full rounded-2xl border px-3 py-2 text-left text-sm ${
                          selectedTicketId === ticket.id
                            ? 'border-accent bg-accent-soft'
                            : 'border-mist-200'
                        }`}
                      >
                        <p className="font-semibold">{ticket.number}</p>
                        <p className="text-navy-700/80">{ticket.title}</p>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {selectedTicket ? (
              <div className="rounded-3xl bg-white p-4 shadow-panel animate-rise">
                <h3 className="font-display text-lg text-navy-900">{selectedTicket.number}</h3>
                <p className="mt-1 text-sm text-navy-700">{selectedTicket.title}</p>
                <dl className="mt-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <dt>Prioridade</dt>
                    <dd className="font-semibold capitalize">{selectedTicket.priority}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>Status</dt>
                    <dd>{selectedTicket.status}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>Vencimento</dt>
                    <dd>
                      {selectedTicket.dueAt
                        ? new Date(selectedTicket.dueAt).toLocaleString('pt-BR')
                        : '—'}
                    </dd>
                  </div>
                </dl>
                {overdue ? (
                  <div className="mt-4 rounded-2xl bg-amber-50 p-3 text-sm text-amber-900">
                    <p>Este chamado está atrasado.</p>
                    <div className="mt-3 flex flex-col gap-2">
                      <button
                        type="button"
                        className="rounded-xl bg-navy-900 px-3 py-2 text-white"
                        onClick={() => setInput('Quero falar com um analista sobre o chamado atrasado')}
                      >
                        Falar com um analista
                      </button>
                      <button
                        type="button"
                        className="rounded-xl bg-white px-3 py-2"
                        onClick={() =>
                          setInput(`Adicionar informação ao chamado ${selectedTicket.number}: `)
                        }
                      >
                        Adicionar informação
                      </button>
                      <button type="button" className="rounded-xl bg-white px-3 py-2">
                        Não, obrigado
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </aside>
        </div>
      </main>
    </div>
  );
}
