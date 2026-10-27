'use client';

import { cx } from '@/lib/ui';

export type TicketPickerItem = {
  id: string;
  number: string;
  title: string;
  status: string;
  statusTone: 'success' | 'warning' | 'danger' | 'neutral' | 'primary';
  date?: string;
};

/** Pencil status dots (Anexo C ticket selector). */
const toneDot: Record<TicketPickerItem['statusTone'], string> = {
  success: 'bg-[#00BD6C]',
  warning: 'bg-[#F5A500]',
  danger: 'bg-danger',
  primary: 'bg-[#0285F7]',
  neutral: 'bg-ink-3',
};

type TicketPickerListProps = {
  tickets: TicketPickerItem[];
  selectedId: string | null;
  onSelect: (ticket: TicketPickerItem) => void;
  disabled?: boolean;
};

/**
 * Pencil “Ticket Selector”: single rounded list, radio rows with
 * number / title / status-dot+label / date. Markup mirrors the export HTML.
 */
export function TicketPickerList({
  tickets,
  selectedId,
  onSelect,
  disabled = false,
}: TicketPickerListProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Seus chamados abertos"
      className="w-full overflow-hidden rounded-2xl bg-paper shadow-panel outline outline-1 outline-offset-[-0.5px] outline-[rgba(27,36,49,0.09)]"
    >
      {tickets.map((ticket, index) => {
        const selected = selectedId === ticket.id;
        return (
          <button
            key={ticket.id}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onSelect(ticket)}
            className={cx(
              'box-border flex h-[46px] w-full shrink-0 flex-row items-center gap-[14px] px-4 text-left',
              index > 0 ? 'border-t border-rule' : null,
              selected ? 'bg-[rgba(0,98,196,0.04)]' : 'bg-paper',
              disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
            )}
          >
            {/* Radio — Pencil: selected = 5px #0062C4 ring; idle = 1.5px #1B243133 */}
            <span
              className={cx(
                'box-border h-4 w-4 shrink-0 rounded-full bg-paper',
                selected
                  ? 'border-[5px] border-[#0062C4]'
                  : 'border-[1.5px] border-[rgba(27,36,49,0.2)]',
              )}
              aria-hidden
            />

            <span className="whitespace-nowrap text-[12.5px] font-medium leading-none text-ink-3">
              {ticket.number}
            </span>

            <span className="min-w-0 flex-1 truncate text-[14.5px] font-medium leading-none text-ink">
              {ticket.title}
            </span>

            <span className="hidden shrink-0 flex-row items-center gap-1.5 sm:inline-flex">
              <span
                className={cx('h-1.5 w-1.5 shrink-0 rounded-full', toneDot[ticket.statusTone])}
                aria-hidden
              />
              <span className="whitespace-nowrap text-[12.5px] font-normal leading-none text-ink-3">
                {ticket.status}
              </span>
            </span>

            {ticket.date ? (
              <span className="w-11 shrink-0 text-right text-[12.5px] font-normal leading-none text-ink-3">
                {ticket.date}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
