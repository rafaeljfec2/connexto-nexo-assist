import type { ReactNode } from 'react';
import { StatusPill } from '@/components/StatusPill';
import { Button } from '@/components/Button';
import { cx } from '@/lib/ui';

export type TicketCardProps = {
  number: string;
  title: string;
  status?: string;
  statusTone?: 'success' | 'warning' | 'danger' | 'neutral' | 'primary';
  category?: string;
  priority?: string;
  openedAt?: string;
  lastUpdate?: string;
  overdue?: boolean;
  description?: string;
  selected?: boolean;
  compact?: boolean;
  onSelect?: () => void;
  actions?: Array<{
    label: string;
    onClick: () => void;
    variant?: 'primary' | 'secondary' | 'ghost';
  }>;
  footer?: ReactNode;
  className?: string;
};

export function TicketCard({
  number,
  title,
  status,
  statusTone = 'warning',
  category,
  priority,
  openedAt,
  lastUpdate,
  overdue = false,
  description,
  selected = false,
  compact = false,
  onSelect,
  actions,
  footer,
  className,
}: TicketCardProps) {
  const body = (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-ink-3">Chamado</span>
          <span className="text-xs font-medium text-ink-3">{number}</span>
        </div>
        {status ? <StatusPill label={status} tone={statusTone} /> : null}
      </div>

      <h3 className={cx('mt-2 font-semibold text-ink', compact ? 'text-sm' : 'text-lg')}>{title}</h3>
      {description ? <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-2">{description}</p> : null}

      {!compact ? (
        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          {category ? (
            <div>
              <dt className="text-xs text-ink-3">Categoria</dt>
              <dd className="mt-0.5 font-medium text-ink">{category}</dd>
            </div>
          ) : null}
          {priority ? (
            <div>
              <dt className="text-xs text-ink-3">Prioridade</dt>
              <dd className="mt-0.5 font-medium capitalize text-ink">{priority}</dd>
            </div>
          ) : null}
          {openedAt ? (
            <div>
              <dt className="text-xs text-ink-3">Aberto em</dt>
              <dd className="mt-0.5 font-medium text-ink">{openedAt}</dd>
            </div>
          ) : null}
          {lastUpdate || overdue ? (
            <div>
              <dt className="text-xs text-ink-3">Última atualização</dt>
              <dd className={cx('mt-0.5 font-medium', overdue ? 'text-warning-text' : 'text-ink')}>
                {lastUpdate ?? '—'}
                {overdue ? <span className="text-ink-3"> · prazo vencido</span> : null}
              </dd>
            </div>
          ) : null}
        </dl>
      ) : null}

      {actions && actions.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {actions.map((action) => (
            <Button
              key={action.label}
              type="button"
              variant={action.variant ?? 'secondary'}
              className="h-9 px-3 text-[13.5px] font-medium"
              onClick={action.onClick}
            >
              {action.label}
            </Button>
          ))}
        </div>
      ) : null}

      {footer}
    </>
  );

  const sharedClass = cx(
    'w-full rounded-xl border p-4 text-left transition',
    selected ? 'border-primary bg-primary-soft' : 'border-rule bg-desk',
    className,
  );

  if (onSelect) {
    return (
      <button type="button" onClick={onSelect} className={sharedClass}>
        {body}
      </button>
    );
  }

  return <div className={sharedClass}>{body}</div>;
}
