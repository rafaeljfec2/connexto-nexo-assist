'use client';

import { useState } from 'react';
import type { ExecutionEvent } from '@/lib/api';
import { humanizeEvent } from '@/lib/event-labels';
import { cx } from '@/lib/ui';

export function EventChips({
  events,
  className,
}: {
  events: ExecutionEvent[];
  className?: string;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  if (events.length === 0) {
    return null;
  }

  const unique = events.filter((event, index, all) => {
    const label = humanizeEvent(event);
    return all.findIndex((e) => humanizeEvent(e) === label) === index;
  });

  return (
    <div className={cx('mb-3 flex w-fit flex-row flex-wrap items-center gap-3', className)}>      <span className="whitespace-nowrap text-[12.5px] font-semibold leading-none text-ink">
        Nexo Assist
      </span>
      {unique.map((event) => {
        const label = humanizeEvent(event);
        const isOpen = openId === event.id;
        return (
          <div key={event.id} className="relative inline-flex items-center">
            <button
              type="button"
              onClick={() => setOpenId(isOpen ? null : event.id)}
              className="inline-flex items-center gap-[5px] text-[12.5px] font-normal leading-none text-ink-3 transition hover:text-ink"
            >
              <svg
                viewBox="0 0 14 14"
                width={12}
                height={12}
                className="shrink-0"
                aria-hidden
              >
                <path
                  d="M11.481 2.953q-.072.014-.13.058-.055.041-3.076 3.066l-3.025 3.008-1.289-1.289q-1.288-1.285-1.381-1.326-.089-.044-.222-.044-.133 0-.232.038-.096.034-.188.113-.089.075-.133.171-.027.072-.034.113-.007.041-.007.14v.041q-.014.113.041.198.072.11.366.403.195.212.967.981l1.497 1.483q.28.267.39.339.072.054.184.041l.096.014q.072 0 .14-.028.085-.071.321-.287.239-.219.8-.762l2.283-2.283q2.085-2.099 2.7-2.714.615-.619.646-.687.041-.085.041-.239 0-.099-.007-.14-.007-.041-.034-.113-.044-.082-.137-.164-.089-.085-.181-.12-.089-.037-.208-.037-.12 0-.188.027z"
                  fill="#5B6472"
                />
              </svg>
              {label}
            </button>
            {isOpen ? (
              <div className="absolute left-0 top-full z-10 mt-2 w-72 rounded-xl border border-rule bg-paper p-3 text-xs shadow-panel">
                <p>
                  <strong>Intenção:</strong> {event.intent ?? '—'}
                </p>
                <p className="mt-1">
                  <strong>Ferramenta:</strong> {event.tool ?? '—'}
                </p>
                <p className="mt-1">
                  <strong>Regra:</strong> {event.rule ?? '—'}
                </p>
                <p className="mt-1">
                  <strong>Resultado:</strong> {event.result}
                </p>
                <p className="mt-1">
                  <strong>Justificativa:</strong> {event.justification}
                </p>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
