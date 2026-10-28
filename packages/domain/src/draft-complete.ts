const TICKET_TYPES = new Set(['incident', 'request']);
const CATEGORIES = new Set([
  'access',
  'hardware',
  'software',
  'network',
  'email',
  'other',
]);
const PRIORITIES = new Set(['critical', 'high', 'medium', 'low']);
const AFFECTED = new Set(['self', 'team', 'company', 'unknown']);

export type CreateDraftCompleteness = {
  readonly complete: boolean;
  readonly missing: readonly string[];
};

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Annex A create-draft required fields before pending HITL or confirm.
 * No silent defaults — missing fields are listed explicitly.
 */
export function assertCreateDraftComplete(
  payload: Record<string, unknown>,
): CreateDraftCompleteness {
  const missing: string[] = [];
  if (!nonEmptyString(payload['title'])) {
    missing.push('title');
  }
  if (!nonEmptyString(payload['description'])) {
    missing.push('description');
  }
  if (!TICKET_TYPES.has(String(payload['type'] ?? ''))) {
    missing.push('type');
  }
  if (!CATEGORIES.has(String(payload['category'] ?? ''))) {
    missing.push('category');
  }
  if (!PRIORITIES.has(String(payload['priority'] ?? ''))) {
    missing.push('priority');
  }
  if (!AFFECTED.has(String(payload['affectedScope'] ?? ''))) {
    missing.push('affectedScope');
  }
  return { complete: missing.length === 0, missing };
}

export function formatMissingCreateFields(missing: readonly string[]): string {
  if (missing.length === 0) {
    return '';
  }
  const labels: Record<string, string> = {
    title: 'título',
    description: 'descrição',
    type: 'tipo',
    category: 'categoria',
    priority: 'prioridade',
    affectedScope: 'quem está sendo afetado',
  };
  const readable = missing.map((key) => labels[key] ?? key);
  if (readable.length === 1) {
    return `Ainda falta ${readable[0]} para abrir o chamado.`;
  }
  const last = readable[readable.length - 1];
  const head = readable.slice(0, -1).join(', ');
  return `Ainda faltam ${head} e ${last} para abrir o chamado.`;
}
