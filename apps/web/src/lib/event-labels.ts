export type EventLabelInput = {
  readonly tool?: string | null;
  readonly rule?: string | null;
  readonly intent?: string | null;
  readonly result?: string;
  readonly justification?: string;
};

/**
 * Chip labels for orchestrator events (Consulta C4/C7 + Novo chamado).
 * Pure helper — unit-tested without React.
 */
export function humanizeEvent(event: EventLabelInput): string {
  const tool = (event.tool ?? '').toLowerCase();
  const rule = (event.rule ?? '').toLowerCase();
  const intent = (event.intent ?? '').toLowerCase();
  const result = event.result ?? '';
  const justification = event.justification ?? '';

  if (rule.includes('priority') || intent.includes('priority') || tool.includes('priority')) {
    return 'classificou a prioridade';
  }
  if (rule.includes('sla') || rule.includes('due') || intent.includes('sla')) {
    // Pencil: draft HITL uses “consultou o SLA”; consulta overdue uses “calculou o prazo”.
    return intent === 'consult' ? 'calculou o prazo' : 'consultou o SLA';
  }
  if (rule.includes('duplicity')) {
    return 'verificou duplicidade';
  }

  const ticketNumber =
    extractTicketNumber(result) ??
    extractTicketNumber(justification) ??
    (rule.includes('ticket.inspect') || tool === 'get_ticket' ? result : null);

  if (rule.includes('ticket.inspect') || tool === 'get_ticket') {
    const number = ticketNumber && /^((?:INC|REQ)-\d+)$/i.test(ticketNumber) ? ticketNumber.toUpperCase() : null;
    return number ? `consultou o ${number}` : 'consultou o chamado';
  }

  if (tool === 'list_my_tickets') return 'consultou seus chamados';
  if (tool === 'search_help') return 'buscou na central de ajuda';
  if (tool === 'prepare_draft') return 'montou o rascunho';

  if (rule.includes('complement_start') || rule.includes('update_needs_description')) {
    const number =
      extractTicketNumber(result) ?? extractTicketNumber(justification);
    return number
      ? `pediu complemento do ${number.toUpperCase()}`
      : 'pediu complemento do chamado';
  }
  if (rule.includes('update_prepared') || (intent === 'update' && rule.includes('draft.'))) {
    const number =
      extractTicketNumber(result) ?? extractTicketNumber(justification);
    return number
      ? `preparou complemento do ${number.toUpperCase()}`
      : 'preparou o complemento';
  }

  if (rule.includes('offer_unsure')) {
    return 'ofereceu um analista';
  }
  if (rule.includes('out_of_it') || intent === 'out_of_it') {
    return 'redirecionou fora de TI';
  }
  if (
    tool.includes('transfer') ||
    intent.includes('transfer') ||
    rule.includes('transfer')
  ) {
    return 'preparou transferência';
  }

  if (rule.startsWith('confirm.') || result === 'draft_confirmed' || result === 'draft_rejected') {
    if (result === 'draft_rejected' || rule.includes('reject')) {
      return 'cancelou o rascunho';
    }
    if (result === 'ask_again' || rule.includes('weak') || rule.includes('unrecognized')) {
      return 'pediu confirmação explícita';
    }
    return 'confirmou o rascunho';
  }

  const fallback = event.tool ?? event.rule ?? event.intent ?? event.result ?? '';
  return fallback.replaceAll('_', ' ');
}

function extractTicketNumber(text: string): string | null {
  const match = /\b((?:INC|REQ)-\d+)\b/i.exec(text);
  return match?.[1] ?? null;
}
