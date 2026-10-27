'use client';

import { FormEvent, useEffect, useRef } from 'react';
import { Button } from '@/components/Button';
import { ChatBubble } from '@/components/ChatBubble';
import {
  BotIcon,
  EllipsisVerticalIcon,
  HandIcon,
  HeadsetIcon,
  SearchIcon,
  SendIcon,
  ArrowRightLeftIcon,
} from '@/components/icons';
import type { Message } from '@/lib/api';
import { initials } from '@/lib/ui';
import {
  avatarStyle,
  extractTicketNumber,
  formatClock,
  formatConversationStatus,
} from './console-helpers';

type ConsoleChatPaneProps = {
  detail: {
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
  } | null;
  error: string | null;
  busy: boolean;
  message: string;
  onMessageChange: (value: string) => void;
  onClaim: () => void;
  onReturn: () => void;
  onClose: () => void;
  onSend: (event: FormEvent) => void;
};

export function ConsoleChatPane({
  detail,
  error,
  busy,
  message,
  onMessageChange,
  onClaim,
  onReturn,
  onClose,
  onSend,
}: ConsoleChatPaneProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) {
      return;
    }
    el.scrollTop = el.scrollHeight;
  }, [detail?.conversation.id, detail?.messages.length, detail?.conversation.status]);

  if (!detail) {
    return (
      <section className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[#EEF1F5]">
        {error ? (
          <p className="mx-4 mt-3 shrink-0 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger-text">
            {error}
          </p>
        ) : null}
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-paper text-2xl font-bold text-cta shadow-panel">
            N
          </div>
          <h2 className="text-lg font-semibold text-ink">Selecione uma conversa</h2>
          <p className="max-w-sm text-sm text-ink-3">
            Escolha um item da fila à esquerda para ver o histórico, assumir o atendimento e
            responder ao funcionário.
          </p>
        </div>
      </section>
    );
  }

  const waiting = detail.conversation.status === 'waiting_analyst';
  const claimed = detail.conversation.status === 'with_analyst';
  const relatedTicket =
    extractTicketNumber(detail.conversation.summary) ??
    [...detail.messages]
      .reverse()
      .map((msg) => extractTicketNumber(msg.content))
      .find(Boolean) ??
    null;
  const style = avatarStyle(detail.employeeName);
  const firstName = detail.employeeName.split(' ')[0] ?? detail.employeeName;

  return (
    <section className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[#EEF1F5]">
      {error ? (
        <p className="mx-4 mt-3 shrink-0 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger-text">
          {error}
        </p>
      ) : null}

      <header className="flex h-16 shrink-0 items-center gap-3 border-b border-rule bg-paper px-5">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[14.5px] font-semibold"
          style={style}
        >
          {initials(detail.employeeName)}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[15.5px] font-semibold text-ink">{detail.employeeName}</h2>
          <p className="truncate text-[12.5px] text-ink-3">
            online · {detail.employeeArea}
            {relatedTicket ? ` · ${relatedTicket}` : ''}
          </p>
        </div>
        {waiting ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[rgba(245,165,0,0.09)] px-2.5 py-1.5 text-[12.5px] font-semibold text-warning-text">
            <BotIcon width={14} height={14} className="text-warning-text" />
            Aguardando atendente
          </span>
        ) : claimed ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-soft px-2.5 py-1.5 text-[12.5px] font-semibold text-primary-text">
            Você está atendendo
          </span>
        ) : (
          <span className="rounded-full bg-desk px-2.5 py-1.5 text-[12.5px] font-semibold text-ink-2">
            {formatConversationStatus(detail.conversation.status)}
          </span>
        )}
        {claimed ? (
          <>
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={onReturn}
              className="h-9 gap-1.5 rounded-lg border border-[rgba(27,36,49,0.12)] bg-paper px-3.5 text-[13.5px] font-medium text-ink-2 shadow-sm"
              leadingIcon={<BotIcon width={15} height={15} />}
            >
              Devolver ao agent
            </Button>
            <Button
              type="button"
              variant="dangerSoft"
              disabled={busy}
              onClick={onClose}
              className="h-9 text-[13.5px]"
            >
              Encerrar
            </Button>
          </>
        ) : null}
        <button
          type="button"
          className="flex h-9 w-9 items-center justify-center rounded-full text-ink-2"
          aria-label="Buscar na conversa"
          tabIndex={-1}
        >
          <SearchIcon width={18} height={18} />
        </button>
        <button
          type="button"
          className="flex h-9 w-9 items-center justify-center rounded-full text-ink-2"
          aria-label="Mais opções"
          tabIndex={-1}
        >
          <EllipsisVerticalIcon width={18} height={18} />
        </button>
      </header>

      <div ref={scrollRef} className="scrollbar-none min-h-0 flex-1 overflow-y-auto">
        <div className="flex min-h-full flex-col justify-end px-10 pb-4 pt-5">
        <div className="mb-1 flex justify-center">
          <span className="rounded-full bg-paper/80 px-2.5 py-1 text-[12px] font-medium text-ink-3">
            Hoje
          </span>
        </div>
        <div className="flex flex-col">
          {detail.messages.map((msg, index) => {
            const previous = detail.messages[index - 1];
            const tight =
              previous &&
              previous.role === msg.role &&
              msg.role === 'employee' &&
              new Date(msg.createdAt).getTime() - new Date(previous.createdAt).getTime() <
                2 * 60 * 1000;

            if (msg.role === 'system') {
              return (
                <div key={msg.id} className="flex items-center gap-3 py-[18px]">
                  <div className="h-px flex-1 bg-[rgba(27,36,49,0.08)]" />
                  <div className="inline-flex items-center gap-1.5 text-[12px] font-medium text-ink-3">
                    <ArrowRightLeftIcon width={13} height={13} />
                    {msg.content}
                    {formatClock(msg.createdAt) ? ` · ${formatClock(msg.createdAt)}` : ''}
                  </div>
                  <div className="h-px flex-1 bg-[rgba(27,36,49,0.08)]" />
                </div>
              );
            }

            const role =
              msg.role === 'employee'
                ? 'employee'
                : msg.role === 'analyst'
                  ? 'analyst'
                  : 'agent';

            return (
              <div key={msg.id} className={tight ? 'pt-[3px]' : 'pt-4'}>
                <ChatBubble
                  role={role}
                  surface="console"
                  time={formatClock(msg.createdAt)}
                  className="max-w-[420px]"
                  meta={
                    role !== 'employee' ? (
                      <div className="flex items-center gap-1.5 px-1 text-[12px]">
                        <span className="font-semibold text-ink-2">
                          {role === 'analyst' ? 'Analista' : 'Nexo Assist'}
                        </span>
                        {role === 'agent' ? (
                          <span className="rounded-md bg-primary-soft px-1.5 py-px text-[11px] font-semibold text-primary-text">
                            IA
                          </span>
                        ) : (
                          <span className="rounded-md bg-success-soft px-1.5 py-px text-[11px] font-semibold text-success-text">
                            Suporte N2
                          </span>
                        )}
                      </div>
                    ) : null
                  }
                >
                  {msg.content}
                </ChatBubble>
              </div>
            );
          })}
        </div>
        </div>
      </div>

      <div className="shrink-0 border-t border-rule bg-paper px-5 pb-3.5 pt-3">
        {waiting ? (
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[rgba(245,165,0,0.09)]">
                <HandIcon width={17} height={17} className="text-warning-text" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[14.5px] font-semibold text-ink">
                  {firstName} espera um atendente
                </p>
                <p className="text-[12.5px] text-ink-3">Agent pausado</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                disabled={busy}
                onClick={onReturn}
                className="h-9 gap-1.5 rounded-lg border border-[rgba(27,36,49,0.12)] bg-paper px-3.5 text-[13.5px] font-medium text-ink-2 shadow-sm"
                leadingIcon={<BotIcon width={15} height={15} />}
              >
                Devolver ao agent
              </Button>
              <Button
                type="button"
                disabled={busy}
                onClick={onClaim}
                className="h-9 gap-1.5 rounded-lg px-4 text-[13.5px]"
                leadingIcon={<HeadsetIcon width={16} height={16} className="text-white" />}
              >
                Assumir atendimento
              </Button>
            </div>
            <div className="flex h-11 items-center rounded-xl bg-desk px-3.5 text-[14.5px] text-ink-3 opacity-55">
              Assuma o atendimento para responder
            </div>
          </div>
        ) : claimed ? (
          <form onSubmit={onSend} className="flex items-center gap-3">
            <input
              className="h-11 flex-1 rounded-xl bg-desk px-3.5 text-[14.5px] text-ink outline-none placeholder:text-ink-3 focus:bg-paper focus:ring-1 focus:ring-cta"
              placeholder="Mensagem para o funcionário"
              value={message}
              onChange={(event) => onMessageChange(event.target.value)}
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
    </section>
  );
}
