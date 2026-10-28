import { describe, expect, it } from 'vitest';
import {
  assertCreateDraftComplete,
  formatMissingCreateFields,
} from '../draft-complete.js';

const completePayload = {
  title: 'VPN erro 809',
  description: 'Não conecta na VPN corporativa',
  type: 'incident',
  category: 'network',
  priority: 'high',
  affectedScope: 'self',
} as const;

describe('assertCreateDraftComplete (AA-3)', () => {
  it('accepts a complete create payload', () => {
    expect(assertCreateDraftComplete({ ...completePayload })).toEqual({
      complete: true,
      missing: [],
    });
  });

  it('lists every missing required field', () => {
    const result = assertCreateDraftComplete({});
    expect(result.complete).toBe(false);
    expect(result.missing).toEqual([
      'title',
      'description',
      'type',
      'category',
      'priority',
      'affectedScope',
    ]);
  });

  it('rejects blank title and unknown enums', () => {
    const result = assertCreateDraftComplete({
      ...completePayload,
      title: '   ',
      type: 'bug',
      category: 'vpn',
    });
    expect(result.complete).toBe(false);
    expect(result.missing).toEqual(['title', 'type', 'category']);
  });

  it('formats missing fields in Portuguese', () => {
    expect(formatMissingCreateFields(['type', 'priority'])).toBe(
      'Ainda faltam tipo e prioridade para abrir o chamado.',
    );
  });
});
