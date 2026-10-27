'use client';

import { ArrowRightLeftIcon, ArrowUpRightIcon, ChevronRightIcon, XIcon } from '@/components/icons';
import {
  formatCategoryPt,
  formatClock,
  formatPriorityPt,
  formatTicketStatus,
  isOpenTicketStatus,
  ticketStatusDot,
  type ConsoleTicket,
} from './console-helpers';

type ConsoleTicketSidebarProps = {
  employeeFirstName: string | null;
  featured: ConsoleTicket | null;
  others: ConsoleTicket[];
  openCount: number;
  closedCount: number;
  onClose: () => void;
  onShowAll: () => void;
};

export function ConsoleTicketSidebar({
  employeeFirstName,
  featured,
  others,
  openCount,
  closedCount,
  onClose,
  onShowAll,
}: ConsoleTicketSidebarProps) {
  return (
    <aside className="hidden h-full min-h-0 w-[340px] shrink-0 flex-col overflow-hidden border-l border-rule bg-paper lg:flex">
      <div className="flex h-16 shrink-0 items-center gap-2 border-b border-rule px-5">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[15.5px] font-semibold text-ink">
            {employeeFirstName ? `Chamados da ${employeeFirstName}` : 'Chamados'}
          </h3>
          <p className="text-[12.5px] text-ink-3">
            {employeeFirstName
              ? `${openCount} abertos · ${closedCount} encerrados`
              : 'Nenhuma conversa selecionada'}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-9 w-9 items-center justify-center rounded-full text-ink-2 hover:bg-desk"
          aria-label="Fechar painel de chamados"
        >
          <XIcon width={18} height={18} />
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-8 overflow-y-auto px-5 py-6">
        <div className="space-y-3">
          <p className="text-[12.5px] font-semibold text-ink-3">Desta conversa</p>
          {!featured ? (
            <p className="text-sm text-ink-3">Nenhum chamado vinculado.</p>
          ) : (
            <div className="space-y-3.5 rounded-xl bg-desk p-4">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 text-[12.5px] font-medium text-ink-3">
                    {featured.number}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      className="h-[7px] w-[7px] rounded-full"
                      style={{ backgroundColor: ticketStatusDot(featured.status) }}
                    />
                    <span
                      className="text-[12.5px] font-semibold"
                      style={{ color: ticketStatusDot(featured.status) }}
                    >
                      {formatTicketStatus(featured.status)}
                    </span>
                  </span>
                </div>
                <p className="text-[15.5px] font-semibold leading-5 text-ink">{featured.title}</p>
                <p className="text-[13.5px] text-ink-3">
                  {formatCategoryPt(featured.category)} · prioridade{' '}
                  {formatPriorityPt(featured.priority)}
                </p>
              </div>
              {featured.lastHistory ? (
                <div className="flex items-center gap-2 border-t border-rule pt-3">
                  <ArrowRightLeftIcon width={15} height={15} className="shrink-0 text-ink-3" />
                  <p className="min-w-0 flex-1 text-[13.5px] text-ink-2">
                    {featured.lastHistory.note}
                  </p>
                  <span className="shrink-0 text-[12.5px] text-ink-3">
                    {formatClock(featured.lastHistory.createdAt)}
                  </span>
                </div>
              ) : null}
            </div>
          )}
        </div>

        <div id="console-other-tickets" className="space-y-1 scroll-mt-4">
          <p className="mb-1 text-[12.5px] font-semibold text-ink-3">Outros chamados</p>
          {others.length === 0 ? (
            <p className="py-3 text-sm text-ink-3">Nenhum outro chamado.</p>
          ) : (
            others.map((ticket, index) => (
              <div
                key={ticket.id}
                className={
                  index < others.length - 1
                    ? 'flex items-center gap-3 border-b border-rule py-3'
                    : 'flex items-center gap-3 py-3'
                }
              >
                <span
                  className="h-[7px] w-[7px] shrink-0 rounded-full"
                  style={{ backgroundColor: ticketStatusDot(ticket.status) }}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14.5px] font-medium text-ink">{ticket.title}</p>
                  <p className="text-[12.5px] text-ink-3">
                    {ticket.number} · {formatTicketStatus(ticket.status)}
                    {!isOpenTicketStatus(ticket.status) && ticket.updatedAt
                      ? ` em ${new Date(ticket.updatedAt).toLocaleDateString('pt-BR', {
                          day: '2-digit',
                          month: 'short',
                        })}`
                      : ''}
                  </p>
                </div>
                <ChevronRightIcon width={16} height={16} className="shrink-0 text-ink-3" />
              </div>
            ))
          )}
        </div>
      </div>

      <div className="shrink-0 px-4 pb-4 pt-3">
        <button
          type="button"
          onClick={onShowAll}
          className="flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-[rgba(27,36,49,0.12)] text-[13.5px] font-medium text-ink-2 shadow-sm hover:bg-desk"
        >
          {employeeFirstName
            ? `Ver todos os chamados da ${employeeFirstName}`
            : 'Ver todos os chamados'}
          <ArrowUpRightIcon width={14} height={14} className="text-ink-3" />
        </button>
      </div>
    </aside>
  );
}
