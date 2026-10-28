export type QueueFilter = 'all' | 'for_you' | 'with_agent' | 'mine';

export type ConsoleTicket = {
  id: string;
  number: string;
  title: string;
  status: string;
  priority: string;
  category: string;
  description: string;
  dueAt: string | null;
  createdAt: string;
  updatedAt: string;
  lastHistory: { note: string; createdAt: string } | null;
};

export const AVATAR_COLORS = [
  '#DCE9F7',
  '#F6E3D3',
  '#E6E1F7',
  '#DDF0E6',
  '#F7E1E6',
  '#E5E8EC',
  '#FBEFD0',
];

export const AVATAR_TEXT = [
  '#0062C4',
  '#9A4A12',
  '#5B3FC4',
  '#1E7A4C',
  '#A3324F',
  '#3D4656',
  '#8A6100',
];

export function avatarStyle(name: string): { backgroundColor: string; color: string } {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash + name.charCodeAt(i) * 17) % 997;
  }
  const index = hash % AVATAR_COLORS.length;
  return {
    backgroundColor: AVATAR_COLORS[index] ?? '#E5E8EC',
    color: AVATAR_TEXT[index] ?? '#3D4656',
  };
}

export function formatConversationStatus(status: string): string {
  const map: Record<string, string> = {
    waiting_analyst: 'Aguardando atendente',
    with_analyst: 'Em atendimento',
    with_agent: 'Agent atendendo',
    closed: 'Encerrada',
  };
  return map[status] ?? status.replaceAll('_', ' ');
}

export function formatTicketStatus(status: string): string {
  const map: Record<string, string> = {
    waiting_analyst: 'Aguardando analista',
    in_progress: 'Em andamento',
    approved: 'Aprovado',
    resolved: 'Resolvido',
    open: 'Aberto',
  };
  return map[status] ?? status.replaceAll('_', ' ');
}

export function ticketStatusDot(status: string): string {
  const value = status.toLowerCase();
  if (value.includes('wait') || value.includes('aguard')) return '#F5A500';
  if (value.includes('progress') || value.includes('andamento')) return '#0285F7';
  if (value.includes('aprov') || value.includes('approved') || value.includes('success')) {
    return '#00BD6C';
  }
  if (value.includes('resolv')) return 'rgba(27,36,49,0.25)';
  return 'rgba(27,36,49,0.33)';
}

export function extractTicketNumber(text: string | null | undefined): string | null {
  if (!text) {
    return null;
  }
  const match = /\b((?:INC|REQ)-\d+)\b/i.exec(text);
  return match?.[1]?.toUpperCase() ?? null;
}

export function queueRowTag(status: string, summary: string | null): {
  label: string;
  tone: 'danger' | 'warning' | 'success' | 'neutral';
} {
  const ticket = extractTicketNumber(summary);
  if (status === 'waiting_analyst') {
    return {
      label: ticket ? `Transferida · ${ticket}` : 'Transferida',
      tone: 'danger',
    };
  }
  if (status === 'with_analyst') {
    return { label: 'Em atendimento humano', tone: 'warning' };
  }
  if (status === 'with_agent') {
    return { label: 'Agent atendendo', tone: 'success' };
  }
  if (status === 'closed') {
    return { label: 'Resolvida pelo agent', tone: 'neutral' };
  }
  return { label: formatConversationStatus(status), tone: 'neutral' };
}

export function tagToneClass(tone: 'danger' | 'warning' | 'success' | 'neutral'): {
  dot: string;
  text: string;
} {
  switch (tone) {
    case 'danger':
      return { dot: 'bg-danger', text: 'text-danger-text' };
    case 'warning':
      return { dot: 'bg-warning', text: 'text-warning-text' };
    case 'success':
      return { dot: 'bg-success', text: 'text-ink-3' };
    default:
      return { dot: 'bg-[rgba(27,36,49,0.33)]', text: 'text-ink-3' };
  }
}

export function formatClock(iso: string | undefined | null): string {
  if (!iso) {
    return '';
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export function formatPriorityPt(priority: string): string {
  const map: Record<string, string> = {
    critical: 'crítica',
    high: 'alta',
    medium: 'média',
    low: 'baixa',
  };
  return map[priority.toLowerCase()] ?? priority;
}

export function formatCategoryPt(category: string): string {
  const map: Record<string, string> = {
    hardware: 'Hardware',
    software: 'Software',
    access: 'Acesso',
    network: 'Rede e VPN',
    email: 'E-mail',
  };
  return map[category.toLowerCase()] ?? category;
}

export function isOpenTicketStatus(status: string): boolean {
  return status !== 'resolved' && status !== 'closed';
}

export function pickFeaturedTicket(
  tickets: ConsoleTicket[],
  messages: Array<{ content: string }>,
  summary: string | null,
): ConsoleTicket | null {
  if (tickets.length === 0) {
    return null;
  }
  const fromSummary = extractTicketNumber(summary);
  if (fromSummary) {
    const hit = tickets.find((ticket) => ticket.number.toUpperCase() === fromSummary);
    if (hit) {
      return hit;
    }
  }
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const number = extractTicketNumber(messages[i]?.content);
    if (!number) {
      continue;
    }
    const hit = tickets.find((ticket) => ticket.number.toUpperCase() === number);
    if (hit) {
      return hit;
    }
  }
  const waiting = tickets.find((ticket) => ticket.status === 'waiting_analyst');
  return waiting ?? tickets[0] ?? null;
}

export function mapTickets(raw: Array<Record<string, unknown>>): ConsoleTicket[] {
  return raw.map((ticket) => {
    const history = ticket['lastHistory'];
    const lastHistory =
      history && typeof history === 'object'
        ? {
            note: String((history as Record<string, unknown>)['note'] ?? ''),
            createdAt: String((history as Record<string, unknown>)['createdAt'] ?? ''),
          }
        : null;
    return {
      id: String(ticket['id']),
      number: String(ticket['number']),
      title: String(ticket['title']),
      status: String(ticket['status']),
      priority: String(ticket['priority'] ?? ''),
      category: String(ticket['category'] ?? ''),
      description: String(ticket['description'] ?? ''),
      dueAt: ticket['dueAt'] == null ? null : String(ticket['dueAt']),
      createdAt: String(ticket['createdAt'] ?? ''),
      updatedAt: String(ticket['updatedAt'] ?? ''),
      lastHistory,
    };
  });
}
