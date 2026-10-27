'use client';

import { useState } from 'react';
import type { ExecutionEvent } from '@/lib/api';

export function EventChips({ events }: { events: ExecutionEvent[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  if (events.length === 0) {
    return null;
  }

  return (
    <div className="mb-2 flex flex-wrap gap-2">
      {events.map((event) => {
        const label = event.tool ?? event.rule ?? event.intent ?? event.result;
        const isOpen = openId === event.id;
        return (
          <div key={event.id} className="relative">
            <button
              type="button"
              onClick={() => setOpenId(isOpen ? null : event.id)}
              className="rounded-full bg-accent-soft px-3 py-1 text-xs font-medium text-navy-800"
            >
              {label}
            </button>
            {isOpen ? (
              <div className="absolute left-0 z-10 mt-2 w-72 rounded-2xl border border-mist-200 bg-white p-3 text-xs shadow-panel">
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
