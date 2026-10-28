'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError, type Message, type User } from '@/lib/api';
import { subscribeConsoleEvents } from '@/lib/sse';
import { AnalystShell } from '@/components/AnalystShell';
import { ConsoleChatPane } from '@/components/console/ConsoleChatPane';
import { ConsoleQueueList } from '@/components/console/ConsoleQueueList';
import { ConsoleTicketSidebar } from '@/components/console/ConsoleTicketSidebar';
import {
  isOpenTicketStatus,
  mapTickets,
  pickFeaturedTicket,
  type ConsoleTicket,
  type QueueFilter,
} from '@/components/console/console-helpers';

type QueueItem = Awaited<ReturnType<typeof api.queue>>[number];

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
  tickets: ConsoleTicket[];
};

export default function ConsolePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [filter, setFilter] = useState<QueueFilter>('for_you');
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [allQueue, setAllQueue] = useState<QueueItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  async function loadQueues(nextFilter: QueueFilter = filter) {
    const [filtered, all] = await Promise.all([
      api.queue(nextFilter),
      nextFilter === 'all' ? Promise.resolve(null) : api.queue('all'),
    ]);
    setQueue(filtered);
    setAllQueue(all ?? filtered);
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
        await loadQueues('for_you');
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
    setSidebarOpen(true);
    try {
      const data = await api.getConsoleConversation(id);
      setDetail({
        ...data,
        tickets: mapTickets(data.tickets),
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Falha ao abrir conversa');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!user) {
      return;
    }
    const sub = subscribeConsoleEvents(selectedId, 0, {
      onEvent: (event) => {
        if (
          event.type === 'message.created' ||
          event.type === 'conversation.updated' ||
          event.type === 'agent.completed' ||
          event.type === 'agent.started'
        ) {
          void loadQueues(filter);
          if (selectedId && event.conversationId === selectedId) {
            void refreshDetail(selectedId);
          }
        }
      },
      onSyncRequired: () => {
        void loadQueues(filter);
        if (selectedId) {
          void refreshDetail(selectedId);
        }
      },
    });
    return () => sub.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, selectedId, filter]);

  async function refreshDetail(id: string) {
    const data = await api.getConsoleConversation(id);
    setDetail({
      ...data,
      tickets: mapTickets(data.tickets),
    });
  }

  async function onClaim() {
    if (!selectedId) return;
    setBusy(true);
    try {
      await api.claim(selectedId);
      await refreshDetail(selectedId);
      await loadQueues(filter);
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
      await api.returnToAgent(selectedId);
      await refreshDetail(selectedId);
      await loadQueues(filter);
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
      await api.close(selectedId);
      await refreshDetail(selectedId);
      await loadQueues(filter);
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
      await api.sendAnalystMessage(selectedId, message.trim());
      await refreshDetail(selectedId);
      setMessage('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Falha ao enviar');
    } finally {
      setBusy(false);
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) {
      return queue;
    }
    return queue.filter(
      (item) =>
        item.employeeName.toLowerCase().includes(q) ||
        item.employeeEmail.toLowerCase().includes(q) ||
        (item.conversation.summary ?? '').toLowerCase().includes(q),
    );
  }, [queue, search]);

  const counts = useMemo(() => {
    const base = { all: allQueue.length, for_you: 0, with_agent: 0, mine: 0 };
    for (const item of allQueue) {
      if (item.conversation.status === 'waiting_analyst') {
        base.for_you += 1;
      } else if (item.conversation.status === 'with_agent') {
        base.with_agent += 1;
      } else if (
        item.conversation.status === 'with_analyst' &&
        item.conversation.analystId === user?.id
      ) {
        base.mine += 1;
      }
    }
    return base;
  }, [allQueue, user?.id]);

  const featured = detail
    ? pickFeaturedTicket(detail.tickets, detail.messages, detail.conversation.summary)
    : null;
  const others = detail
    ? detail.tickets.filter((ticket) => ticket.id !== featured?.id)
    : [];
  const openCount = detail
    ? detail.tickets.filter((ticket) => isOpenTicketStatus(ticket.status)).length
    : 0;
  const closedCount = detail ? detail.tickets.length - openCount : 0;
  const waitingCount = counts.for_you;

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

  return (
    <AnalystShell user={user} badgeCount={waitingCount}>
      <ConsoleQueueList
        filter={filter}
        counts={counts}
        items={filtered}
        selectedId={selectedId}
        search={search}
        onSearchChange={setSearch}
        onFilterChange={(value) => {
          setFilter(value);
          void loadQueues(value);
        }}
        onSelect={(id) => void selectConversation(id)}
      />
      <ConsoleChatPane
        detail={detail}
        error={error}
        busy={busy}
        message={message}
        onMessageChange={setMessage}
        onClaim={() => void onClaim()}
        onReturn={() => void onReturn()}
        onClose={() => void onClose()}
        onSend={(event) => void onSend(event)}
      />
      {sidebarOpen ? (
        <ConsoleTicketSidebar
          employeeFirstName={detail?.employeeName.split(' ')[0] ?? null}
          featured={featured}
          others={others}
          openCount={openCount}
          closedCount={closedCount}
          onClose={() => setSidebarOpen(false)}
          onShowAll={() => {
            document.getElementById('console-other-tickets')?.scrollIntoView({
              behavior: 'smooth',
              block: 'start',
            });
          }}
        />
      ) : null}
    </AnalystShell>
  );
}
