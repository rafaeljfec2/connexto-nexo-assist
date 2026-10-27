'use client';

import { useState } from 'react';
import type { ExecutionEvent } from '@/lib/api';

export function EventChips({ events }: { events: ExecutionEvent[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  if (events.length === 0) {
    return null;
  }

  return (
    <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
      <span className="text-xs font-semibold text-ink">Nexo Assist</span>
      {events.map((event) => {
        const label = event.tool ?? event.rule ?? event.intent ?? event.result;
        const isOpen = openId === event.id;
        return (
          <div key={event.id} className="relative">
            <button
              type="button"
              onClick={() => setOpenId(isOpen ? null : event.id)}
              className="rounded-full bg-desk px-2.5 py-1 text-xs font-normal text-ink-3 transition hover:bg-mist-100"
            >
              {label}
            </button>
            {isOpen ? (
              <div className="absolute left-0 z-10 mt-2 w-72 rounded-xl border border-rule bg-paper p-3 text-xs shadow-panel">
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
