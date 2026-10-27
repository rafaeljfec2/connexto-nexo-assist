'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError, type Message, type User } from '@/lib/api';
import { AnalystShell } from '@/components/AnalystShell';
import { Button } from '@/components/Button';
import { ChatBubble } from '@/components/ChatBubble';
import { StatusPill } from '@/components/StatusPill';
import { SearchIcon, SendIcon } from '@/components/icons';
import { cx, initials } from '@/lib/ui';

type QueueItem = {
  conversation: {
    id: string;
    status: string;
    summary: string | null;
    employeeMessageCount: number;
    analystId: string | null;
  };
  employeeName: string;
  employeeEmail: string;
  employeeArea: string;
};

type Detail = {
  conversation: {
    id: string;
    status: string;
    summary: string | null;
    analystId: string | null;
  };
  employeeName: string;
  employeeEmail: string;
  employeeArea: string;
  messages: Message[];
  tickets: Array<Record<string, unknown>>;
};

const avatarColors = ['#DCE9F7', '#F6E3D3', '#E6E1F7', '#DDF0E6', '#F7E1E6', '#E5E8EC', '#FBEFD0'];

function avatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash + name.charCodeAt(i) * 17) % 997;
  return avatarColors[hash % avatarColors.length] ?? '#E5E8EC';
}

function formatStatus(status: string): string {
  const map: Record<string, string> = {
    waiting_analyst: 'Aguardando atendente',
    with_analyst: 'Em atendimento',
    with_agent: 'Agent atendendo',
    closed: 'Encerrada',
  };
  return map[status] ?? status.replaceAll('_', ' ');
}

export default function ConsolePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [filter, setFilter] = useState<'for_you' | 'with_agent' | 'mine'>('for_you');
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  async function loadQueue(nextFilter = filter) {
    const rows = await api.queue(nextFilter);
    setQueue(rows);
  }

  useEffect(() => {
    void (async () => {
      try {
        const me = await api.me();
        if (me.user.role !== 'analyst') {
          setError('Acesso restrito a analistas.');
          setLoading(false);
          return;
        }
        setUser(me.user);
        await loadQueue('for_you');
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          router.replace('/login');
          return;
        }
        if (err instanceof ApiError && err.status === 403) {
          setError('Acesso restrito a analistas.');
        } else {
          setError(err instanceof Error ? err.message : 'Falha ao carregar console');
        }
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function selectConversation(id: string) {
    setSelectedId(id);
    setBusy(true);
    try {
      const data = await api.getConsoleConversation(id);
      setDetail(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Falha ao abrir conversa');
    } finally {
      setBusy(false);
    }
  }

  async function onClaim() {
    if (!selectedId) return;
    setBusy(true);
    try {
      const data = (await api.claim(selectedId)) as Detail;
      setDetail(data);
      await loadQueue(filter);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível assumir');
    } finally {
      setBusy(false);
    }
  }

  async function onReturn() {
    if (!selectedId) return;
    setBusy(true);
    try {
      const data = (await api.returnToAgent(selectedId)) as Detail;
      setDetail(data);
      await loadQueue(filter);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Falha ao devolver');
    } finally {
      setBusy(false);
    }
  }

  async function onClose() {
    if (!selectedId) return;
    setBusy(true);
    try {
      const data = (await api.close(selectedId)) as Detail;
      setDetail(data);
      await loadQueue(filter);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Falha ao encerrar');
    } finally {
      setBusy(false);
    }
  }

  async function onSend(event: FormEvent) {
    event.preventDefault();
    if (!selectedId || !message.trim()) return;
    setBusy(true);
    try {
      const data = (await api.sendAnalystMessage(selectedId, message.trim())) as Detail;
      setDetail(data);
      setMessage('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Falha ao enviar');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="animate-pulse-soft">Carregando console…</p>
      </div>
    );
  }

  if (error && !user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <p className="rounded-2xl bg-danger-soft px-4 py-3 text-danger-text">{error}</p>
        <button
          type="button"
          className="text-primary-text underline"
          onClick={() => router.replace('/login')}
        >
          Voltar ao login
        </button>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const filtered = queue.filter((item) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      item.employeeName.toLowerCase().includes(q) ||
      item.employeeEmail.toLowerCase().includes(q) ||
      (item.conversation.summary ?? '').toLowerCase().includes(q)
    );
  });

  const waitingCount = queue.filter((q) => q.conversation.status === 'waiting_analyst').length;
  const currentTickets = detail?.tickets ?? [];
  const claimed = detail?.conversation.status === 'with_analyst';
  const waiting = detail?.conversation.status === 'waiting_analyst';

  return (
    <AnalystShell user={user} badgeCount={waitingCount}>
      <section className="flex w-[380px] shrink-0 flex-col border-r border-rule">
        <div className="space-y-3 border-b border-rule px-4 pb-2.5 pt-4">
          <div className="flex items-center justify-between gap-2">
            <h1 className="text-xl font-bold text-ink">Conversas</h1>
            <StatusPill label="Disponível" tone="success" />
          </div>
          <label className="flex h-9 items-center gap-2.5 rounded-full bg-desk px-3">
            <SearchIcon className="text-ink-3" width={15} height={15} />
            <input
              className="w-full bg-transparent text-[13.5px] text-ink outline-none placeholder:text-ink-3"
              placeholder="Pesquisar conversa ou chamado"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Buscar"
            />
          </label>
          <div className="flex flex-wrap gap-1">
            {(
              [
                ['for_you', 'Para você'],
                ['with_agent', 'Com o agent'],
                ['mine', 'Minhas'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setFilter(value);
                  void loadQueue(value);
                }}
                className={cx(
                  'rounded-full px-2.5 py-1.5 text-xs font-medium transition',
                  filter === value
                    ? 'bg-primary-soft text-primary-text'
                    : 'bg-desk text-ink-2 hover:bg-mist-100',
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <ul className="flex-1 space-y-0.5 overflow-y-auto px-2 py-2">
          {filtered.map((item) => {
            const selected = selectedId === item.conversation.id;
            const color = avatarColor(item.employeeName);
            return (
              <li key={item.conversation.id}>
                <button
                  type="button"
                  onClick={() => void selectConversation(item.conversation.id)}
                  className={cx(
                    'flex w-full gap-3 rounded-xl p-2.5 text-left transition',
                    selected ? 'bg-desk' : 'hover:bg-desk/70',
                  )}
                >
                  <div
                    className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-full text-[15.5px] font-semibold"
                    style={{ backgroundColor: color, color: '#0062C4' }}
                  >
                    {initials(item.employeeName)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="truncate font-semibold text-ink">{item.employeeName}</p>
                      <span className="shrink-0 text-xs font-semibold text-cta">
                        {item.conversation.employeeMessageCount}
                      </span>
                    </div>
                    <p className="mt-0.5 line-clamp-1 text-[13.5px] text-ink-3">
                      {item.conversation.summary ?? 'Sem resumo'}
                    </p>
                    <p className="mt-1 text-[11.5px] font-medium text-ink-3">
                      {formatStatus(item.conversation.status)}
                    </p>
                  </div>
                </button>
              </li>
            );
          })}
          {filtered.length === 0 ? (
            <p className="px-3 py-6 text-sm text-ink-3">Fila vazia para este filtro.</p>
          ) : null}
        </ul>
      </section>

      <section className="flex min-w-0 flex-1 flex-col bg-[#EEF1F5]">
        {error ? (
          <p className="mx-4 mt-3 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger-text">
            {error}
          </p>
        ) : null}

        {!detail ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-paper text-2xl font-bold text-cta shadow-panel">
              N
            </div>
            <h2 className="text-lg font-semibold text-ink">Selecione uma conversa</h2>
            <p className="max-w-sm text-sm text-ink-3">
              Escolha um item da fila à esquerda para ver o histórico, assumir o atendimento e
              responder ao funcionário.
            </p>
          </div>
        ) : (
          <>
            <header className="flex h-16 items-center gap-3 border-b border-rule bg-paper px-5">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold text-cta"
                style={{ backgroundColor: avatarColor(detail.employeeName) }}
              >
                {initials(detail.employeeName)}
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="truncate font-semibold text-ink">{detail.employeeName}</h2>
                <p className="truncate text-xs text-ink-3">
                  {detail.employeeEmail} · {detail.employeeArea}
                </p>
              </div>
              {waiting ? (
                <StatusPill label="Aguardando atendente" tone="warning" />
              ) : claimed ? (
                <StatusPill label="Você está atendendo" tone="primary" />
              ) : (
                <StatusPill label={formatStatus(detail.conversation.status)} tone="neutral" />
              )}
              {claimed ? (
                <>
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={busy}
                    onClick={() => void onReturn()}
                    className="h-9"
                  >
                    Devolver ao agent
                  </Button>
                  <Button
                    type="button"
                    variant="dangerSoft"
                    disabled={busy}
                    onClick={() => void onClose()}
                    className="h-9"
                  >
                    Encerrar atendimento
                  </Button>
                </>
              ) : null}
            </header>

            <div className="flex-1 space-y-4 overflow-y-auto px-10 py-5">
              {detail.messages.map((msg) => {
                const role =
                  msg.role === 'employee'
                    ? 'employee'
                    : msg.role === 'analyst'
                      ? 'analyst'
                      : 'agent';
                return (
                  <ChatBubble
                    key={msg.id}
                    role={role === 'employee' ? 'employee' : role}
                    align="start"
                    agentStyle="tint"
                    className="max-w-[75%]"
                    meta={
                      role !== 'employee' ? (
                        <div className="flex items-center gap-1.5 text-[11px]">
                          <span className="font-semibold text-ink-2">
                            {role === 'analyst' ? 'Analista' : 'Nexo Assist'}
                          </span>
                          {role === 'agent' ? (
                            <span className="font-semibold text-primary-text">IA</span>
                          ) : (
                            <span className="font-semibold text-success-text">Suporte N2</span>
                          )}
                        </div>
                      ) : null
                    }
                  >
                    {msg.content}
                  </ChatBubble>
                );
              })}
            </div>

            <div className="border-t border-rule bg-paper px-5 py-3">
              {waiting ? (
                <div className="space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-[14.5px] font-semibold text-ink">
                        {detail.employeeName.split(' ')[0]} espera um atendente
                      </p>
                      <p className="text-xs text-ink-3">Agent pausado</p>
                    </div>
                    <Button
                      type="button"
                      disabled={busy}
                      onClick={() => void onClaim()}
                      className="h-9"
                    >
                      Assumir atendimento
                    </Button>
                  </div>
                  <div className="flex h-11 items-center rounded-xl bg-desk px-3.5 text-[14.5px] text-ink-3">
                    Assuma o atendimento para responder
                  </div>
                </div>
              ) : claimed ? (
                <form onSubmit={onSend} className="flex items-center gap-3">
                  <input
                    className="h-11 flex-1 rounded-xl bg-desk px-3.5 text-[14.5px] text-ink outline-none placeholder:text-ink-3 focus:bg-paper focus:ring-1 focus:ring-cta"
                    placeholder="Mensagem para o funcionário"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    aria-label="Mensagem do analista"
                  />
                  <Button
                    type="submit"
                    disabled={busy || !message.trim()}
                    className="h-11 w-11 rounded-full px-0"
                    aria-label="Enviar"
                  >
                    <SendIcon className="text-white" />
                  </Button>
                </form>
              ) : (
                <p className="text-sm text-ink-3">Esta conversa não está disponível para resposta.</p>
              )}
            </div>
          </>
        )}
      </section>

      <aside className="hidden w-[340px] shrink-0 flex-col border-l border-rule bg-paper xl:flex">
        <div className="flex h-16 items-center border-b border-rule px-5">
          <div>
            <h3 className="font-semibold text-ink">
              {detail ? `Chamados da ${detail.employeeName.split(' ')[0]}` : 'Chamados'}
            </h3>
            <p className="text-xs text-ink-3">
              {detail
                ? `${currentTickets.length} vinculados a esta conversa`
                : 'Nenhuma conversa selecionada'}
            </p>
          </div>
        </div>
        <div className="flex-1 space-y-6 overflow-y-auto p-5">
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-3">
              Desta conversa
            </p>
            {currentTickets.length === 0 ? (
              <p className="text-sm text-ink-3">Nenhum chamado vinculado.</p>
            ) : (
              <ul className="space-y-3">
                {currentTickets.map((ticket) => (
                  <li key={String(ticket['id'])} className="rounded-xl bg-desk p-4">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-ink-3">
                        {String(ticket['number'])}
                      </span>
                      <StatusPill
                        label={formatStatus(String(ticket['status']))}
                        tone={
                          String(ticket['status']).includes('wait') ? 'warning' : 'primary'
                        }
                      />
                    </div>
                    <p className="mt-2 font-semibold text-ink">{String(ticket['title'])}</p>
                    <p className="mt-1 text-[13.5px] text-ink-3">
                      {String(ticket['priority'] ?? '')} · {String(ticket['status'])}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {detail?.conversation.summary ? (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-3">
                Resumo
              </p>
              <p className="text-sm leading-relaxed text-ink-2">{detail.conversation.summary}</p>
            </div>
          ) : null}
        </div>
      </aside>
    </AnalystShell>
  );
}
