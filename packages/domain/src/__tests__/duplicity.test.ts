import { describe, expect, it } from 'vitest';
import { detectDuplicity, tokenOverlap } from '../duplicity.js';
import type { DuplicateCandidate } from '@nexo-assist/contracts';

const base: DuplicateCandidate = {
  ticketId: '11111111-1111-4111-8111-111111111111',
  number: 'INC-20311',
  category: 'hardware',
  title: 'Notebook não liga',
  description: 'Meu notebook Dell não inicia após atualização',
  errorCode: null,
  status: 'waiting_analyst',
};

describe('detectDuplicity', () => {
  it('returns strong match for same error code and category', () => {
    const decision = detectDuplicity(
      {
        category: 'network',
        title: 'VPN falhou',
        description: 'Erro ao conectar VPN corporativa',
        errorCode: '809',
      },
      [
        {
          ...base,
          category: 'network',
          title: 'VPN',
          description: 'Falha VPN',
          errorCode: '809',
          status: 'in_progress',
        },
      ],
    );
    expect(decision.match).toBe('strong');
    expect(decision.score).toBe(1);
  });

  it('returns ambiguous for mid-band overlap', () => {
    const decision = detectDuplicity(
      {
        category: 'hardware',
        title: 'Notebook problema',
        description: 'Dell atualização',
        errorCode: null,
      },
      [base],
    );
    expect(['ambiguous', 'strong']).toContain(decision.match);
    expect(decision.score).toBeGreaterThanOrEqual(0.3);
  });

  it('ignores resolved tickets', () => {
    const decision = detectDuplicity(
      {
        category: 'hardware',
        title: 'Notebook não liga',
        description: 'Meu notebook Dell não inicia após atualização',
        errorCode: null,
      },
      [{ ...base, status: 'resolved' }],
    );
    expect(decision.match).toBe('none');
  });

  it('returns multiple when two strong candidates exist', () => {
    const a = {
      ...base,
      ticketId: '22222222-2222-4222-8222-222222222222',
      number: 'INC-1',
      errorCode: 'E1',
      category: 'software' as const,
    };
    const b = {
      ...base,
      ticketId: '33333333-3333-4333-8333-333333333333',
      number: 'INC-2',
      errorCode: 'E1',
      category: 'software' as const,
    };
    const decision = detectDuplicity(
      {
        category: 'software',
        title: 'App',
        description: 'Erro',
        errorCode: 'E1',
      },
      [a, b],
    );
    expect(decision.match).toBe('multiple');
    expect(decision.candidates).toHaveLength(2);
  });

  it('returns none below 0.3 overlap', () => {
    expect(tokenOverlap('alpha beta gamma', 'delta epsilon zeta')).toBe(0);
    const decision = detectDuplicity(
      {
        category: 'email',
        title: 'Caixa de entrada',
        description: 'Outlook lento',
        errorCode: null,
      },
      [base],
    );
    expect(decision.match).toBe('none');
  });
});
