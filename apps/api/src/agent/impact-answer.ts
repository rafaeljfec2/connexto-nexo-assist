import type { AffectedScope } from '@nexo-assist/contracts';

/**
 * Parse structured impact choices from the Novo chamado flow (Figma chips).
 */
export function parseAffectedScope(text: string): AffectedScope | null {
  const normalized = text
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
  if (
    normalized.includes('so eu') ||
    normalized.includes('somente eu') ||
    normalized.includes('apenas eu')
  ) {
    return 'self';
  }
  if (normalized.includes('minha equipe') || normalized.includes('meu time')) {
    return 'team';
  }
  if (normalized.includes('toda a empresa') || normalized.includes('empresa toda')) {
    return 'company';
  }
  if (normalized.includes('nao sei')) {
    return 'unknown';
  }
  return null;
}

export function looksLikeImpactQuestion(content: string): boolean {
  const normalized = content.toLowerCase();
  return (
    normalized.includes('quem está sendo afetado') ||
    normalized.includes('quem esta sendo afetado') ||
    normalized.includes('quem está afetado') ||
    normalized.includes('quem esta afetado') ||
    normalized.includes('afetados?')
  );
}

/**
 * `messages` must be newest-first (as returned by `orderBy(desc(createdAt))`).
 */
export function lastAssistantAskedImpact(
  messages: readonly { readonly role: string; readonly content: string }[],
): boolean {
  for (const message of messages) {
    if (message.role !== 'agent' && message.role !== 'assistant') {
      continue;
    }
    if (!message.content.trim()) {
      continue;
    }
    return looksLikeImpactQuestion(message.content);
  }
  return false;
}

/**
 * Previous employee problem report (not the impact chip answer itself).
 * `messages` must be newest-first.
 */
export function findPriorProblemReport(
  messages: readonly { readonly role: string; readonly content: string }[],
  currentContent: string,
): string | null {
  for (const message of messages) {
    if (message.role !== 'employee' && message.role !== 'user') {
      continue;
    }
    if (message.content.trim() === currentContent.trim()) {
      continue;
    }
    if (parseAffectedScope(message.content)) {
      continue;
    }
    const trimmed = message.content.trim();
    if (trimmed.length > 0) {
      return trimmed;
    }
  }
  return null;
}

export function inferCategoryFromText(text: string): string {
  const normalized = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
  if (normalized.includes('vpn') || normalized.includes('rede') || /\b809\b/.test(normalized)) {
    return 'network';
  }
  if (
    normalized.includes('notebook') ||
    normalized.includes('monitor') ||
    normalized.includes('hardware') ||
    normalized.includes('mouse') ||
    normalized.includes('teclado')
  ) {
    return 'hardware';
  }
  if (normalized.includes('email') || normalized.includes('outlook')) {
    return 'email';
  }
  if (normalized.includes('acesso') || normalized.includes('sharepoint') || normalized.includes('permiss')) {
    return 'access';
  }
  if (normalized.includes('software') || normalized.includes('aplicativo') || normalized.includes('sistema')) {
    return 'software';
  }
  return 'other';
}

export function titleFromProblemReport(text: string): string {
  const compact = text.replace(/\s+/g, ' ').trim();
  if (compact.length <= 80) {
    return compact;
  }
  return `${compact.slice(0, 77).trim()}...`;
}
