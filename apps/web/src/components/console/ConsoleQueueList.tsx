'use client';

import { SearchIcon } from '@/components/icons';
import { StatusPill } from '@/components/StatusPill';
import { cx, initials } from '@/lib/ui';
import {
  avatarStyle,
  formatClock,
  queueRowTag,
  tagToneClass,
  type QueueFilter,
} from './console-helpers';

export type ConsoleQueueItem = {
  conversation: {
    id: string;
    status: string;
    summary: string | null;
    employeeMessageCount: number;
    analystId: string | null;
    updatedAt?: string;
  };
  employeeName: string;
  employeeEmail: string;
  employeeArea: string;
};

type ConsoleQueueListProps = {
  filter: QueueFilter;
  counts: Record<QueueFilter, number>;
  items: ConsoleQueueItem[];
  selectedId: string | null;
  search: string;
  onSearchChange: (value: string) => void;
  onFilterChange: (value: QueueFilter) => void;
  onSelect: (id: string) => void;
};

const FILTERS: Array<{ value: QueueFilter; label: string }> = [
  { value: 'all', label: 'Todas' },
  { value: 'for_you', label: 'Para você' },
  { value: 'with_agent', label: 'Com o agent' },
  { value: 'mine', label: 'Minhas' },
];

export function ConsoleQueueList({
  filter,
  counts,
  items,
  selectedId,
  search,
  onSearchChange,
  onFilterChange,
  onSelect,
}: ConsoleQueueListProps) {
  return (
    <section className="flex h-full min-h-0 w-[380px] shrink-0 flex-col overflow-hidden border-r border-rule">
      <div className="shrink-0 space-y-3 px-4 pb-2.5 pt-4">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-[20px] font-bold tracking-[-0.3px] text-ink">Conversas</h1>
          <StatusPill label="Disponível" tone="success" dot />
        </div>
        <label className="flex h-9 items-center gap-2.5 rounded-full bg-desk px-3">
          <SearchIcon className="text-ink-3" width={15} height={15} />
          <input
            className="w-full bg-transparent text-[13.5px] text-ink outline-none placeholder:text-ink-3"
            placeholder="Pesquisar conversa ou chamado"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            aria-label="Buscar"
          />
        </label>
        <div className="flex flex-wrap gap-1">
          {FILTERS.map(({ value, label }) => {
            const active = filter === value;
            const count = counts[value];
            return (
              <button
                key={value}
                type="button"
                onClick={() => onFilterChange(value)}
                className={cx(
                  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[12.5px] font-medium transition',
                  active
                    ? 'bg-primary-soft text-primary-text'
                    : 'bg-desk text-ink-2 hover:bg-mist-100',
                )}
              >
                {label}
                {value !== 'all' ? (
                  <span className={cx('font-semibold', active ? 'text-primary-text' : 'text-ink-3')}>
                    {count}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      <ul className="min-h-0 flex-1 space-y-0 overflow-y-auto px-2 pb-3">
        {items.map((item) => {
          const selected = selectedId === item.conversation.id;
          const style = avatarStyle(item.employeeName);
          const tag = queueRowTag(item.conversation.status, item.conversation.summary);
          const tone = tagToneClass(tag.tone);
          const sessionCount =
            item.conversation.status === 'waiting_analyst'
              ? Math.max(1, Math.min(item.conversation.employeeMessageCount, 9))
              : 0;
          return (
            <li key={item.conversation.id}>
              <button
                type="button"
                onClick={() => onSelect(item.conversation.id)}
                className={cx(
                  'flex w-full gap-3 rounded-xl p-2.5 text-left transition',
                  selected ? 'bg-desk' : 'hover:bg-desk/70',
                )}
              >
                <div
                  className="relative flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-full text-[15.5px] font-semibold"
                  style={style}
                >
                  {initials(item.employeeName)}
                  <span
                    className={cx(
                      'absolute bottom-0 right-0 h-[11px] w-[11px] rounded-full border-2',
                      selected ? 'border-desk' : 'border-paper',
                      item.conversation.status === 'closed' ? 'bg-ink-3' : 'bg-success',
                    )}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p
                      className={cx(
                        'min-w-0 flex-1 truncate text-[15.5px] text-ink',
                        selected || sessionCount > 0 ? 'font-semibold' : 'font-medium',
                      )}
                    >
                      {item.employeeName}
                    </p>
                    <span
                      className={cx(
                        'shrink-0 text-[12.5px]',
                        sessionCount > 0 ? 'font-semibold text-cta' : 'font-normal text-ink-3',
                      )}
                    >
                      {formatClock(item.conversation.updatedAt) || '—'}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-1.5">
                    <p className="min-w-0 flex-1 truncate text-[13.5px] text-ink-3">
                      {item.conversation.summary ?? 'Sem resumo'}
                    </p>
                    {sessionCount > 0 ? (
                      <span
                        className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-cta px-1.5 text-[11.5px] font-bold text-white"
                        title="Mensagens do funcionário nesta sessão"
                        aria-label={`${sessionCount} mensagens do funcionário nesta sessão`}
                      >
                        {sessionCount}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-1 flex items-center gap-1.5">
                    <span className={cx('h-1.5 w-1.5 rounded-full', tone.dot)} />
                    <span className={cx('text-[11.5px] font-medium', tone.text)}>{tag.label}</span>
                  </div>
                </div>
              </button>
            </li>
          );
        })}
        {items.length === 0 ? (
          <p className="px-3 py-6 text-sm text-ink-3">Fila vazia para este filtro.</p>
        ) : null}
      </ul>
    </section>
  );
}
