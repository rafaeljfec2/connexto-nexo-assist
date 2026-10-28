import { describe, expect, it } from 'vitest';
import { formatDraftConfirmFeedback } from './agent.draft-store';

describe('formatDraftConfirmFeedback', () => {
  it('includes ticket number on create confirm', () => {
    expect(
      formatDraftConfirmFeedback({
        confirmed: true,
        action: 'create',
        mutation: { number: 'INC-20320', status: 'waiting_analyst' },
      }),
    ).toBe('Pronto. Criei o chamado INC-20320. Ele está na fila de analistas.');
  });

  it('returns cancel copy on reject', () => {
    expect(
      formatDraftConfirmFeedback({
        confirmed: false,
        action: 'create',
        mutation: null,
      }),
    ).toBe('Rascunho cancelado. Como posso ajudar agora?');
  });
});
