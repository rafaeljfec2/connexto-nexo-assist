import { describe, expect, it } from 'vitest';
import { evaluateConfirmation } from '../confirmation.js';

const draft = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  version: 2,
  status: 'pending' as const,
};

describe('evaluateConfirmation', () => {
  it('confirms exact draft version via button', () => {
    const result = evaluateConfirmation({
      draft,
      draftId: draft.id,
      version: 2,
      confirm: true,
    });
    expect(result.kind).toBe('confirm');
  });

  it('rejects version mismatch', () => {
    const result = evaluateConfirmation({
      draft,
      draftId: draft.id,
      version: 1,
      confirm: true,
    });
    expect(result.kind).toBe('mismatch');
  });

  it('accepts explicit free-text confirmation', () => {
    const result = evaluateConfirmation({
      draft,
      freeText: 'Confirmo',
    });
    expect(result.kind).toBe('confirm');
  });

  it('asks again for weak affirmations like ok', () => {
    const result = evaluateConfirmation({
      draft,
      freeText: 'ok',
    });
    expect(result.kind).toBe('ask_again');
    expect(result).toMatchObject({ rule: 'confirm.weak_affirmation' });
  });

  it('asks again for parece bom', () => {
    const result = evaluateConfirmation({
      draft,
      freeText: 'parece bom',
    });
    expect(result.kind).toBe('ask_again');
  });

  it('rejects with explicit cancel text', () => {
    const result = evaluateConfirmation({
      draft,
      freeText: 'cancelar',
    });
    expect(result.kind).toBe('reject');
  });
});
