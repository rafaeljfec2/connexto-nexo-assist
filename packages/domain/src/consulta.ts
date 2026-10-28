/**
 * Frozen Consulta de chamado rule IDs (Screen 2 / Anexo C).
 * Full prose lives in docs/SPEC_CONSULTA_CHAMADO.md.
 */
export const CONSULTA_RULE_IDS = [
  'C1',
  'C2',
  'C3',
  'C4',
  'C5',
  'C6',
  'C7',
  'C8',
  'C9',
] as const;

export type ConsultaRuleId = (typeof CONSULTA_RULE_IDS)[number];

/** Annex A medium SLA ≈ 3 business days (30 business hours at 10h/day). */
export const MEDIUM_SLA_BUSINESS_DAYS = 3;

export function isTicketOverdue(input: {
  readonly dueAt: Date;
  readonly status: string;
  readonly now?: Date;
}): boolean {
  if (input.status === 'resolved') {
    return false;
  }
  const now = input.now ?? new Date();
  return input.dueAt.getTime() < now.getTime();
}

/**
 * Relative last-update label in pt-BR for the detail card (C5).
 * Uses calendar-day buckets so UI and tests share one contract.
 */
export function formatRelativeUpdatePt(from: Date, now: Date = new Date()): string {
  const diffMs = Math.max(0, now.getTime() - from.getTime());
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) {
    return 'agora';
  }
  if (minutes < 60) {
    return `há ${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return hours === 1 ? 'há 1 hora' : `há ${hours} horas`;
  }
  const days = Math.floor(hours / 24);
  return days === 1 ? 'há 1 dia' : `há ${days} dias`;
}

/** Short compact-list date (C3), e.g. "16 out". */
export function formatShortDatePt(date: Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: 'numeric',
    month: 'short',
    timeZone: 'America/Sao_Paulo',
  })
    .format(date)
    .replace(/\./g, '')
    .replace(/\s+de\s+/gi, ' ')
    .trim();
}

/** Opened-at label for the detail card (C5), e.g. "16 out, 14:20". */
export function formatOpenedAtPt(date: Date): string {
  const day = formatShortDatePt(date);
  const time = new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: 'America/Sao_Paulo',
  }).format(date);
  return `${day}, ${time}`;
}

export function formatPriorityPt(priority: string): string {
  const map: Record<string, string> = {
    critical: 'Crítica',
    high: 'Alta',
    medium: 'Média',
    low: 'Baixa',
  };
  return map[priority] ?? priority;
}

export function formatCategoryLabel(category: string, title = ''): string {
  const normalized = category.toLowerCase();
  if (normalized === 'hardware' && /notebook|laptop|monitor/i.test(title)) {
    if (/monitor/i.test(title)) return 'Hardware › Monitor';
    return 'Hardware › Notebook';
  }
  const map: Record<string, string> = {
    hardware: 'Hardware',
    access: 'Acesso',
    network: 'Rede e VPN',
    software: 'Software',
    email: 'E-mail',
    other: 'Outros',
  };
  return map[normalized] ?? category;
}

/**
 * Figma Consulta list turn (C2): UI TicketPicker already shows numbers/titles —
 * agent text must stay a short intro (never enumerate tickets).
 */
export function buildTicketListIntro(openCount: number): string {
  const n = Math.max(0, openCount);
  if (n === 1) {
    return 'Você tem 1 chamado aberto. Sobre qual deles quer saber?';
  }
  return `Você tem ${n} chamados abertos. Sobre qual deles quer saber?`;
}

/** Prototype overdue follow-up under the detail card (C5/C6). */
export function buildOverdueConsultaPrompt(input: {
  readonly updatedAt: Date;
  readonly now?: Date;
  readonly businessDays?: number;
}): string {
  const now = input.now ?? new Date();
  const days = Math.max(
    1,
    Math.floor((now.getTime() - input.updatedAt.getTime()) / (24 * 60 * 60 * 1000)),
  );
  const slaDays = input.businessDays ?? MEDIUM_SLA_BUSINESS_DAYS;
  const dayLabel = days === 1 ? '1 dia' : `${days} dias`;
  return `Está sem atualização há ${dayLabel}, acima do prazo de ${slaDays} dias úteis para prioridade média. Quer que eu chame um analista?`;
}
