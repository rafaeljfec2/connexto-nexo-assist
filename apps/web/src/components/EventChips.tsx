'use client';

import { useState } from 'react';
import type { ExecutionEvent } from '@/lib/api';

function humanizeEvent(event: ExecutionEvent): string {
  const tool = (event.tool ?? '').toLowerCase();
  const rule = (event.rule ?? '').toLowerCase();
  const intent = (event.intent ?? '').toLowerCase();

  if (tool === 'list_my_tickets') return 'consultou seus chamados';
  if (tool === 'search_help') return 'buscou na central de ajuda';
  if (tool === 'prepare_draft') return 'montou o rascunho';
  if (rule.includes('priority') || intent.includes('priority') || tool.includes('priority')) {
    return 'classificou a prioridade';
  }
  if (rule.includes('sla') || rule.includes('due') || intent.includes('sla')) {
    return 'consultou o SLA';
  }
  if (tool.includes('transfer') || intent.includes('transfer')) return 'preparou transferência';

  const fallback = event.tool ?? event.rule ?? event.intent ?? event.result;
  return fallback.replaceAll('_', ' ');
}

export function EventChips({ events }: { events: ExecutionEvent[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  if (events.length === 0) {
    return null;
  }

  const unique = events.filter((event, index, all) => {
    const label = humanizeEvent(event);
    return all.findIndex((e) => humanizeEvent(e) === label) === index;
  });

  return (
    <div className="mb-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
      <span className="text-xs font-semibold text-ink">Nexo Assist</span>
      {unique.map((event) => {
        const label = humanizeEvent(event);
        const isOpen = openId === event.id;
        return (
          <div key={event.id} className="relative inline-flex items-center gap-1">
            <button
              type="button"
              onClick={() => setOpenId(isOpen ? null : event.id)}
              className="inline-flex items-center gap-1 text-xs text-ink-3 transition hover:text-ink"
            >
              <span className="text-success-text" aria-hidden>
                ✓
              </span>
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
