'use client';

import { useEffect } from 'react';
import type { Draft } from '@/lib/api';
import { formatPriorityPt } from '@nexo-assist/domain';
import { cx } from '@/lib/ui';

const affectedLabels: Record<string, string> = {
  self: 'Somente você',
  team: 'Minha equipe',
  company: 'Toda a empresa',
  unknown: 'Não sei',
};

const categoryLabels: Record<string, string> = {
  network: 'Rede e VPN',
  access: 'Acesso',
  hardware: 'Hardware',
  software: 'Software',
  email: 'E-mail',
  other: 'Outros',
};

function str(value: unknown): string {
  return typeof value === 'string' ? value : value != null ? String(value) : '';
}

function inferPriorityKey(payload: Record<string, unknown>): string | null {
  const explicit = str(payload['priority']);
  if (explicit) return explicit;

  const scope = str(payload['affectedScope']);
  const workStopped = payload['workStopped'];
  const sameDay = payload['sameDayCommitment'];
  const hasAlternative = payload['hasAlternative'];

  if (scope === 'team' || scope === 'company') {
    if (workStopped === true) return 'critical';
    return 'high';
  }
  if (scope === 'self' && (workStopped === true || sameDay === true)) return 'high';
  if (scope === 'self' && hasAlternative === true) return 'medium';
  if (scope === 'self') return 'low';
  return null;
}

function formatDueTime(iso: string): string | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: 'America/Sao_Paulo',
  }).format(date);
}

type DraftConfirmCardProps = {
  draft: Draft;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  onEdit?: () => void;
};

/** Pencil “Confirmation Card” for HITL draft (Novo chamado). */
export function DraftConfirmCard({
  draft,
  busy = false,
  onConfirm,
  onCancel,
  onEdit,
}: DraftConfirmCardProps) {
  const payload = draft.payload;
  const title = str(payload['title']) || 'Novo chamado';
  const description = str(payload['description']);
  const categoryKey = str(payload['category']);
  const category = categoryLabels[categoryKey] ?? (categoryKey || '—');
  const affected = affectedLabels[str(payload['affectedScope'])] ?? null;
  const priorityKey = inferPriorityKey(payload);
  const priority = priorityKey ? formatPriorityPt(priorityKey) : null;
  const dueAtRaw = str(payload['dueAt']);
  const dueTime = dueAtRaw ? formatDueTime(dueAtRaw) : null;
  const kind =
    draft.action === 'update'
      ? 'Atualização'
      : draft.action === 'reopen'
        ? 'Reabertura'
        : 'Novo chamado';
  const draftCode = `D-${String(draft.version).padStart(3, '0')}`;
  const priorityTone = priorityKey === 'critical' || priorityKey === 'high' ? 'warning' : 'neutral';

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (busy) return;
      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
        event.preventDefault();
        onConfirm();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onConfirm]);

  return (
    <div className="w-full overflow-hidden rounded-2xl bg-paper shadow-panel outline outline-1 outline-offset-[-0.5px] outline-[rgba(27,36,49,0.09)]">
      <div className="flex flex-col gap-1.5 px-[18px] pb-3.5 pt-4">
        <div className="flex w-full flex-row items-center gap-2 pb-0.5">
          <span className="whitespace-nowrap text-[12.5px] font-medium leading-none text-ink-3">
            {kind}
          </span>
          <span className="h-[3px] w-[3px] shrink-0 rounded-full bg-rule" aria-hidden />
          <span className="whitespace-nowrap text-[12.5px] font-normal leading-none text-ink-3">
            Rascunho {draftCode}
          </span>
          <span className="h-px min-w-0 flex-1" aria-hidden />
          <span className="inline-flex shrink-0 flex-row items-center gap-1.5">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#F5A500]" aria-hidden />
            <span className="whitespace-nowrap text-[12.5px] font-medium leading-none text-warning-text">
              Aguardando confirmação
            </span>
          </span>
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
        <dl className="grid grid-cols-1 gap-x-6 border-t border-rule pt-3 sm:grid-cols-3">
          <div className="flex flex-col gap-1">
            <dt className="text-[12.5px] font-normal leading-none text-ink-3">Categoria</dt>
            <dd className="whitespace-nowrap text-[14.5px] font-medium leading-none text-ink">
              {category}
            </dd>
          </div>
          {priority ? (
            <div className="flex flex-col gap-1">
              <dt className="text-[12.5px] font-normal leading-none text-ink-3">Prioridade</dt>
              <dd className="inline-flex flex-wrap items-center gap-1.5">
                <span className="inline-flex items-center gap-1.5">
                  <span
                    className={cx(
                      'h-1.5 w-1.5 shrink-0 rounded-full',
                      priorityTone === 'warning' ? 'bg-[#F5A500]' : 'bg-[rgba(27,36,49,0.4)]',
                    )}
                    aria-hidden
                  />
                  <span className="whitespace-nowrap text-[14.5px] font-medium leading-none text-ink">
                    {priority}
                  </span>
                </span>
                {dueTime ? (
                  <span className="whitespace-nowrap text-[13.5px] font-normal leading-none text-ink-3">
                    · resposta até {dueTime}
                  </span>
                ) : null}
              </dd>
            </div>
          ) : null}
          {affected ? (
            <div className="flex flex-col gap-1">
              <dt className="text-[12.5px] font-normal leading-none text-ink-3">Afetados</dt>
              <dd className="whitespace-nowrap text-[14.5px] font-medium leading-none text-ink">
                {affected}
              </dd>
            </div>
          ) : null}
        </dl>
      </div>

      <div className="flex flex-row items-center gap-1.5 border-t border-rule bg-desk py-2 pl-2 pr-3.5">
        <button
          type="button"
          disabled={busy}
          onClick={onConfirm}
          className="inline-flex h-9 shrink-0 flex-row items-center gap-2 rounded-lg bg-[#0062C4] py-0 pl-3.5 pr-2.5 text-[13.5px] font-semibold text-white disabled:opacity-50"
        >
          Confirmar
          <span className="rounded-md bg-white/14 px-1.5 py-px text-[11.5px] font-normal text-white/80">
            ⌘↵
          </span>
        </button>
        {onEdit ? (
          <button
            type="button"
            disabled={busy}
            onClick={onEdit}
            className="inline-flex h-9 shrink-0 items-center rounded-lg bg-paper px-3.5 text-[13.5px] font-medium text-ink shadow-[0_1px_2px_rgba(27,36,49,0.05)] outline outline-1 outline-offset-[-0.5px] outline-[rgba(27,36,49,0.12)] disabled:opacity-50"
          >
            Editar
          </button>
        ) : null}
        <button
          type="button"
          disabled={busy}
          onClick={onCancel}
          className="inline-flex h-9 shrink-0 items-center rounded-lg px-3.5 text-[13.5px] font-medium text-ink-2 disabled:opacity-50"
        >
          Cancelar
        </button>
        <span className="h-px min-w-0 flex-1" aria-hidden />
      </div>
    </div>
  );
}
