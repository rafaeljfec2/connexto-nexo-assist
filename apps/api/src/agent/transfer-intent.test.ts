import { describe, expect, it } from 'vitest';
import { requestsAnalystTransfer } from './transfer-intent';

describe('requestsAnalystTransfer', () => {
  it('accepts explicit analyst handoff phrases', () => {
    expect(requestsAnalystTransfer('Quero falar com um analista')).toBe(true);
    expect(requestsAnalystTransfer('Preciso de um analista agora')).toBe(true);
  });

  it('accepts atendente / humano / suporte synonyms from the PRD handoff intent', () => {
    expect(requestsAnalystTransfer('Quero falar com um atendente')).toBe(true);
    expect(requestsAnalystTransfer('Preciso de um atendente')).toBe(true);
    expect(requestsAnalystTransfer('Quero atendimento humano')).toBe(true);
    expect(
      requestsAnalystTransfer('quero falar com o suporte sobre esse chamado'),
    ).toBe(true);
  });

  it('rejects bare substring mentions', () => {
    expect(requestsAnalystTransfer('O analista já viu meu chamado?')).toBe(false);
    expect(requestsAnalystTransfer('Posso falar com você sobre VPN?')).toBe(false);
    expect(requestsAnalystTransfer('status do chamado')).toBe(false);
  });
});
