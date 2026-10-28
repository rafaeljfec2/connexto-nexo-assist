import type { TurnEvent } from '../agent.types';

export type HandoffReason = 'explicit' | 'critical' | 'unsure_accepted';

/**
 * Structured analyst handoff summary (AA-5) — not a raw message slice.
 * Aggregates prior conversation context when provided.
 */
export function buildHandoffSummary(input: {
  readonly employeeContent: string;
  readonly events: readonly TurnEvent[];
  readonly reason: HandoffReason;
  readonly priorEvents?: readonly TurnEvent[];
  readonly recentMessages?: readonly {
    readonly role: string;
    readonly content: string;
  }[];
}): string {
  const allEvents = [...(input.priorEvents ?? []), ...input.events];
  const intent =
    allEvents.map((e) => e.intent).find((value) => Boolean(value)) ?? input.reason;
  const rules = [
    ...new Set(
      allEvents.map((e) => e.rule).filter((rule): rule is string => Boolean(rule)),
    ),
  ].slice(0, 6);

  const messageCorpus = [
    ...(input.recentMessages?.map((m) => m.content) ?? []),
    input.employeeContent,
  ].join('\n');
  const ticketRefs = [
    ...new Set(
      [...messageCorpus.matchAll(/\b((?:INC|REQ)-\d+)\b/gi)].map((m) =>
        m[1]!.toUpperCase(),
      ),
    ),
  ];

  const priorEmployeeProblem = (input.recentMessages ?? [])
    .filter(
      (m) =>
        m.role === 'employee' &&
        m.content.trim().toLowerCase() !== input.employeeContent.trim().toLowerCase(),
    )
    .at(-1)?.content;

  const reasonLabel =
    input.reason === 'critical'
      ? 'prioridade crítica'
      : input.reason === 'unsure_accepted'
        ? 'funcionário aceitou oferta por baixa confiança do agent'
        : 'pedido explícito de analista';

  const parts = [
    `Motivo: ${reasonLabel}`,
    `Intenção: ${intent}`,
    rules.length > 0 ? `Regras: ${rules.join(', ')}` : null,
    ticketRefs.length > 0 ? `Chamados: ${ticketRefs.join(', ')}` : null,
    priorEmployeeProblem
      ? `Contexto: ${priorEmployeeProblem.trim().slice(0, 160)}`
      : null,
    `Última mensagem: ${input.employeeContent.trim().slice(0, 120)}`,
  ].filter((part): part is string => Boolean(part));

  return parts.join(' · ').slice(0, 480);
}

export const UNSURE_OFFER_TEXT =
  'Não tenho segurança suficiente para seguir sozinho. Quer que eu chame um analista?';

export function shouldOfferUnsureHandoff(input: {
  readonly confidence: 'high' | 'medium' | 'low';
  readonly transferAlready: boolean;
  readonly hasPendingDraft: boolean;
  readonly events: readonly TurnEvent[];
}): boolean {
  if (input.transferAlready || input.hasPendingDraft) {
    return false;
  }
  if (input.confidence !== 'low') {
    return false;
  }
  return input.events.some((event) => {
    const result = event.result.toLowerCase();
    const rule = (event.rule ?? '').toLowerCase();
    return (
      result === 'needs_clarification' ||
      result === 'ambiguous' ||
      result === 'tool_error' ||
      rule.includes('ambiguous') ||
      rule === 'draft.create_incomplete'
    );
  });
}

/** True when the latest agent turn asked to call an analyst (unsure or overdue offer). */
export function hasOpenAnalystOffer(
  messagesNewestFirst: readonly { readonly role: string; readonly content: string }[],
): boolean {
  const lastAgent = messagesNewestFirst.find(
    (m) => m.role === 'agent' || m.role === 'assistant',
  );
  if (!lastAgent) {
    return false;
  }
  const normalized = lastAgent.content
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
  return (
    normalized.includes('chame um analista') ||
    normalized.includes('nao tenho seguranca suficiente')
  );
}

/**
 * Affirmative replies to an open analyst offer.
 * Must be gated with `hasOpenAnalystOffer` — never alone.
 */
export function acceptsUnsureOffer(content: string): boolean {
  const normalized = content
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ');
  const phrases = [
    'sim, chame um analista',
    'sim chame um analista',
    'chame um analista',
    'pode chamar um analista',
    'quero que chame um analista',
    'sim, por favor',
    'sim por favor',
  ];
  return phrases.some((phrase) => {
    const needle = phrase.normalize('NFD').replace(/\p{M}/gu, '');
    return normalized.includes(needle);
  });
}

export function resolveHandoffReason(input: {
  readonly transferRequested: boolean;
  readonly explicitAsk: boolean;
  readonly acceptedOffer: boolean;
}): HandoffReason {
  if (input.acceptedOffer) {
    return 'unsure_accepted';
  }
  if (input.transferRequested && !input.explicitAsk) {
    return 'critical';
  }
  return 'explicit';
}
