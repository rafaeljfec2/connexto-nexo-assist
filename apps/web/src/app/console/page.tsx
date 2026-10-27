'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError, type Message, type User } from '@/lib/api';

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
        <p className="rounded-2xl bg-red-50 px-4 py-3 text-red-700">{error}</p>
        <button
          type="button"
          className="text-accent underline"
          onClick={() => router.replace('/login')}
        >
          Voltar ao login
        </button>
      </div>
    );
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

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b border-mist-200 bg-white/80 px-6 py-4 backdrop-blur">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-navy-700/60">Nexo Assist</p>
          <h1 className="font-display text-2xl text-navy-900">Console do analista</h1>
        </div>
        <div className="text-right text-sm">
          <p>{user?.name}</p>
          <button
            type="button"
            className="text-accent"
            onClick={async () => {
              await api.logout();
              router.replace('/login');
            }}
          >
            Sair
          </button>
        </div>
      </header>

      {error ? (
        <p className="mx-6 mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      ) : null}

      <div className="grid gap-4 p-4 xl:grid-cols-[320px_1fr_320px]">
        <section className="rounded-3xl bg-white p-4 shadow-panel">
          <input
            className="w-full rounded-xl border border-mist-200 bg-mist-50 px-3 py-2 text-sm"
            placeholder="Buscar funcionário ou resumo"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="mt-3 flex gap-2">
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
                className={`rounded-full px-3 py-1 text-xs ${
                  filter === value ? 'bg-navy-900 text-white' : 'bg-mist-100 text-navy-800'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <ul className="mt-4 space-y-2">
            {filtered.map((item) => (
              <li key={item.conversation.id}>
                <button
                  type="button"
                  onClick={() => void selectConversation(item.conversation.id)}
                  className={`w-full rounded-2xl border px-3 py-3 text-left ${
                    selectedId === item.conversation.id
                      ? 'border-accent bg-accent-soft'
                      : 'border-mist-200'
                  }`}
                >
                  <p className="font-semibold text-navy-900">{item.employeeName}</p>
                  <p className="text-xs text-navy-700/70">{item.conversation.status}</p>
                  <p className="mt-1 line-clamp-2 text-sm text-navy-700">
                    {item.conversation.summary ?? 'Sem resumo'}
                  </p>
                </button>
              </li>
            ))}
            {filtered.length === 0 ? (
              <p className="text-sm text-navy-700/70">Fila vazia para este filtro.</p>
            ) : null}
          </ul>
        </section>

        <section className="rounded-3xl bg-white p-4 shadow-panel">
          {!detail ? (
            <p className="text-sm text-navy-700/70">Selecione uma conversa da fila.</p>
          ) : (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-display text-2xl text-navy-900">{detail.employeeName}</h2>
                  <p className="text-sm text-navy-700/70">
                    {detail.employeeEmail} · {detail.employeeArea}
                  </p>
                  <p className="mt-2 text-sm">Status: {detail.conversation.status}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {detail.conversation.status === 'waiting_analyst' ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void onClaim()}
                      className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white"
                    >
                      Assumir
                    </button>
                  ) : null}
                  {detail.conversation.status === 'with_analyst' ? (
                    <>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void onReturn()}
                        className="rounded-xl bg-mist-100 px-4 py-2 text-sm font-semibold"
                      >
                        Devolver ao agent
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void onClose()}
                        className="rounded-xl bg-navy-900 px-4 py-2 text-sm font-semibold text-white"
                      >
                        Encerrar atendimento
                      </button>
                    </>
                  ) : null}
                </div>
              </div>

              <div className="mt-4 max-h-[55vh] space-y-3 overflow-y-auto rounded-2xl bg-mist-50 p-4">
                {detail.messages.map((msg) => (
                  <div key={msg.id} className="rounded-2xl bg-white px-3 py-2 text-sm shadow-sm">
                    <p className="text-[11px] uppercase tracking-wide text-navy-700/50">
                      {msg.role}
                    </p>
                    <p className="mt-1">{msg.content}</p>
                  </div>
                ))}
              </div>

              {detail.conversation.status === 'with_analyst' ? (
                <form onSubmit={onSend} className="mt-4 flex gap-2">
                  <input
                    className="flex-1 rounded-xl border border-mist-200 px-3 py-2 text-sm"
                    placeholder="Mensagem para o funcionário"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                  />
                  <button
                    type="submit"
                    disabled={busy || !message.trim()}
                    className="rounded-xl bg-navy-900 px-4 py-2 text-sm font-semibold text-white"
                  >
                    Enviar
                  </button>
                </form>
              ) : null}
            </>
          )}
        </section>

        <section className="rounded-3xl bg-white p-4 shadow-panel">
          <h3 className="font-display text-lg text-navy-900">Resumo e chamados</h3>
          <p className="mt-2 text-sm text-navy-700">
            {detail?.conversation.summary ?? 'Selecione uma conversa para ver o resumo.'}
          </p>
          <ul className="mt-4 space-y-2">
            {(detail?.tickets ?? []).map((ticket) => (
              <li
                key={String(ticket['id'])}
                className="rounded-2xl border border-mist-200 px-3 py-2 text-sm"
              >
                <p className="font-semibold">{String(ticket['number'])}</p>
                <p>{String(ticket['title'])}</p>
                <p className="text-xs text-navy-700/70">
                  {String(ticket['status'])} · {String(ticket['priority'])}
                </p>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
