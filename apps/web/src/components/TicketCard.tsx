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
  className?: string;
};

const statusDot: Record<NonNullable<TicketCardProps['statusTone']>, string> = {
  success: 'bg-[#00BD6C]',
  warning: 'bg-[#F5A500]',
  danger: 'bg-danger',
  primary: 'bg-[#0285F7]',
  neutral: 'bg-ink-3',
};

const statusLabel: Record<NonNullable<TicketCardProps['statusTone']>, string> = {
  success: 'text-success-text',
  warning: 'text-warning-text',
  danger: 'text-danger-text',
  primary: 'text-primary-text',
  neutral: 'text-ink-3',
};

/** Pencil detail ticket card after inspect (Anexo C consulta). */
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
  className,
}: TicketCardProps) {
  return (
    <div
      className={cx(
        'w-full overflow-hidden rounded-2xl bg-paper shadow-panel outline outline-1 outline-offset-[-0.5px] outline-[rgba(27,36,49,0.09)]',
        className,
      )}
    >
      <div className="flex flex-col gap-1.5 px-[18px] pb-3.5 pt-4">
        <div className="flex w-full flex-row items-center gap-2 pb-0.5">
          <span className="whitespace-nowrap text-[12.5px] font-medium leading-none text-ink-3">
            Chamado
          </span>
          <span className="h-[3px] w-[3px] shrink-0 rounded-full bg-rule" aria-hidden />
          <span className="whitespace-nowrap text-[12.5px] font-normal leading-none text-ink-3">
            {number}
          </span>
          <span className="h-px min-w-0 flex-1" aria-hidden />
          {status ? (
            <span className="inline-flex shrink-0 flex-row items-center gap-1.5">
              <span
                className={cx('h-1.5 w-1.5 shrink-0 rounded-full', statusDot[statusTone])}
                aria-hidden
              />
              <span
                className={cx(
                  'whitespace-nowrap text-[12.5px] font-medium leading-none',
                  statusLabel[statusTone],
                )}
              >
                {status}
              </span>
            </span>
          ) : null}
        </div>

        <h3 className="w-full text-left text-[18px] font-semibold leading-[23px] tracking-[-0.2px] text-ink">
          {title}
        </h3>
        {description ? (
          <p className="w-full text-left text-[13.5px] font-normal leading-5 text-ink-2">
            {description}
          </p>
        ) : null}
      </div>

      <div className="px-[18px] pb-4">
        <dl className="grid grid-cols-2 gap-x-6 border-t border-rule pt-3 sm:grid-cols-4">
          {category ? (
            <div className="flex flex-col gap-1">
              <dt className="whitespace-nowrap text-[12.5px] font-normal leading-none text-ink-3">
                Categoria
              </dt>
              <dd className="whitespace-nowrap text-[14.5px] font-medium leading-none text-ink">
                {category}
              </dd>
            </div>
          ) : null}
          {priority ? (
            <div className="flex flex-col gap-1">
              <dt className="whitespace-nowrap text-[12.5px] font-normal leading-none text-ink-3">
                Prioridade
              </dt>
              <dd className="inline-flex items-center gap-1.5">
                <span
                  className="h-1.5 w-1.5 shrink-0 rounded-full bg-[rgba(27,36,49,0.4)]"
                  aria-hidden
                />
                <span className="whitespace-nowrap text-[14.5px] font-medium leading-none text-ink">
                  {priority}
                </span>
              </dd>
            </div>
          ) : null}
          {openedAt ? (
            <div className="flex flex-col gap-1">
              <dt className="whitespace-nowrap text-[12.5px] font-normal leading-none text-ink-3">
                Aberto em
              </dt>
              <dd className="whitespace-nowrap text-[14.5px] font-medium leading-none text-ink">
                {openedAt}
              </dd>
            </div>
          ) : null}
          {lastUpdate || overdue ? (
            <div className="flex flex-col gap-1">
              <dt className="whitespace-nowrap text-[12.5px] font-normal leading-none text-ink-3">
                Última atualização
              </dt>
              <dd className="inline-flex flex-wrap items-center gap-1.5">
                <span
                  className={cx(
                    'whitespace-nowrap text-[14.5px] font-medium leading-none',
                    overdue ? 'text-warning-text' : 'text-ink',
                  )}
                >
                  {lastUpdate ?? '—'}
                </span>
                {overdue ? (
                  <span className="whitespace-nowrap text-[13.5px] font-normal leading-none text-ink-3">
                    · prazo vencido
                  </span>
                ) : null}
              </dd>
            </div>
          ) : null}
        </dl>
      </div>
    </div>
  );
}
