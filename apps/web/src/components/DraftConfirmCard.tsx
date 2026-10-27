import { Button } from '@/components/Button';
import type { Draft } from '@/lib/api';

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

function inferPriorityLabel(payload: Record<string, unknown>): string | null {
  const explicit = str(payload['priority']);
  if (explicit) return explicit.charAt(0).toUpperCase() + explicit.slice(1);

  const scope = str(payload['affectedScope']);
  const workStopped = payload['workStopped'];
  const sameDay = payload['sameDayCommitment'];
  const hasAlternative = payload['hasAlternative'];

  if (scope === 'team' || scope === 'company') {
    if (workStopped === true) return 'Crítica';
    return 'Alta';
  }
  if (scope === 'self' && (workStopped === true || sameDay === true)) return 'Alta';
  if (scope === 'self' && hasAlternative === true) return 'Média';
  if (scope === 'self') return 'Baixa';
  return null;
}

type DraftConfirmCardProps = {
  draft: Draft;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  onEdit?: () => void;
};

export function DraftConfirmCard({
  draft,
  busy = false,
  onConfirm,
  onCancel,
  onEdit,
}: DraftConfirmCardProps) {
  const payload = draft.payload;
  const title = str(payload['title']) || str(draft.action) || 'Novo chamado';
  const description = str(payload['description']);
  const categoryKey = str(payload['category']);
  const category = categoryLabels[categoryKey] ?? (categoryKey || '—');
  const affected = affectedLabels[str(payload['affectedScope'])] ?? null;
  const priority = inferPriorityLabel(payload);
  const kind =
    draft.action === 'update'
      ? 'Atualização'
      : draft.action === 'reopen'
        ? 'Reabertura'
        : 'Novo chamado';

  return (
    <div className="w-full overflow-hidden rounded-2xl border border-[rgba(27,36,49,0.09)] bg-paper shadow-panel">
      <div className="space-y-1.5 px-[18px] pb-3.5 pt-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[12.5px] font-medium text-ink-3">{kind}</span>
          <span className="h-1 w-1 rounded-full bg-rule" aria-hidden />
          <span className="text-[12.5px] text-ink-3">Rascunho D-{draft.version}</span>
          <span className="ml-auto inline-flex items-center gap-1.5 text-[12.5px] font-medium text-warning-text">
            <span className="h-1.5 w-1.5 rounded-full bg-warning" aria-hidden />
            Aguardando confirmação
          </span>
        </div>
        <h3 className="text-lg font-semibold tracking-tight text-ink">{title}</h3>
        {description ? (
          <p className="text-[13.5px] leading-relaxed text-ink-2">{description}</p>
        ) : null}
      </div>

      <div className="border-t border-rule px-[18px] pb-4 pt-3">
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <dt className="text-[12.5px] text-ink-3">Categoria</dt>
            <dd className="mt-1 text-[14.5px] font-medium text-ink">{category}</dd>
          </div>
          {priority ? (
            <div>
              <dt className="text-[12.5px] text-ink-3">Prioridade</dt>
              <dd className="mt-1 flex items-center gap-2 text-[14.5px] font-medium text-ink">
                <span className="h-2 w-2 rounded-full bg-warning" aria-hidden />
                {priority}
              </dd>
            </div>
          ) : null}
          {affected ? (
            <div>
              <dt className="text-[12.5px] text-ink-3">Afetados</dt>
              <dd className="mt-1 text-[14.5px] font-medium text-ink">{affected}</dd>
            </div>
          ) : null}
        </dl>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button type="button" disabled={busy} onClick={onConfirm} className="h-9">
            Confirmar
          </Button>
          {onEdit ? (
            <Button type="button" variant="secondary" disabled={busy} onClick={onEdit} className="h-9">
              Editar
            </Button>
          ) : null}
          <Button type="button" variant="ghost" disabled={busy} onClick={onCancel} className="h-9">
            Cancelar
          </Button>
        </div>
      </div>
    </div>
  );
}
