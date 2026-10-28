import { describe, expect, it } from 'vitest';
import {
  acceptsUnsureOffer,
  buildHandoffSummary,
  hasOpenAnalystOffer,
  resolveHandoffReason,
  shouldOfferUnsureHandoff,
  UNSURE_OFFER_TEXT,
} from './handoff-summary';

describe('handoff summary + unsure offer (AA-5 / HA-2)', () => {
  it('builds a structured summary with reason, prior context and ticket refs', () => {
    const summary = buildHandoffSummary({
      employeeContent: 'Sim, chame um analista',
      events: [
        {
          intent: 'talk_to_analyst',
          tool: null,
          rule: 'transfer.conversation',
          result: 'waiting_analyst',
          justification: 'transfer',
        },
      ],
      priorEvents: [
        {
          intent: 'create',
          tool: null,
          rule: 'transfer.offer_unsure',
          result: 'offer',
          justification: 'stall',
        },
        {
          intent: 'create',
          tool: 'search_help',
          rule: null,
          result: 'ok',
          justification: 'help',
        },
      ],
      recentMessages: [
        {
          role: 'employee',
          content: 'Meu notebook não conecta na VPN corporativa, erro 809.',
        },
        { role: 'agent', content: UNSURE_OFFER_TEXT },
        { role: 'employee', content: 'Sim, chame um analista' },
      ],
      reason: 'unsure_accepted',
    });
    expect(summary).toMatch(/baixa confiança/i);
    expect(summary).toContain('transfer.offer_unsure');
    expect(summary).toMatch(/VPN|809/i);
    expect(summary).toContain('Contexto:');
  });

  it('offers handoff only on low-confidence stall without draft', () => {
    expect(
      shouldOfferUnsureHandoff({
        confidence: 'low',
        transferAlready: false,
        hasPendingDraft: false,
        events: [
          {
            intent: 'create',
            tool: null,
            rule: 'priority.ask_impact',
            result: 'needs_clarification',
            justification: 'ask',
          },
        ],
      }),
    ).toBe(true);
    expect(
      shouldOfferUnsureHandoff({
        confidence: 'low',
        transferAlready: false,
        hasPendingDraft: false,
        events: [
          {
            intent: 'out_of_it',
            tool: null,
            rule: 'scope.out_of_it.hr',
            result: 'redirected',
            justification: 'redirect',
          },
        ],
      }),
    ).toBe(false);
  });

  it('gates offer acceptance on an open analyst offer', () => {
    expect(acceptsUnsureOffer('Sim, chame um analista')).toBe(true);
    expect(acceptsUnsureOffer('sim, por favor')).toBe(true);
    expect(
      hasOpenAnalystOffer([
        { role: 'agent', content: UNSURE_OFFER_TEXT },
        { role: 'employee', content: 'Não sei' },
      ]),
    ).toBe(true);
    expect(
      hasOpenAnalystOffer([
        { role: 'agent', content: 'Preparei o rascunho versão 1.' },
        { role: 'employee', content: 'oi' },
      ]),
    ).toBe(false);
  });

  it('resolves unsure_accepted when offer was accepted', () => {
    expect(
      resolveHandoffReason({
        transferRequested: false,
        explicitAsk: false,
        acceptedOffer: true,
      }),
    ).toBe('unsure_accepted');
    expect(
      resolveHandoffReason({
        transferRequested: true,
        explicitAsk: false,
        acceptedOffer: false,
      }),
    ).toBe('critical');
    expect(
      resolveHandoffReason({
        transferRequested: false,
        explicitAsk: true,
        acceptedOffer: false,
      }),
    ).toBe('explicit');
  });
});
