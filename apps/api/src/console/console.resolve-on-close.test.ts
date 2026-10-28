import { describe, expect, it } from 'vitest';
import {
  extractTicketNumber,
  pickLinkedTicketNumber,
} from './console.resolve-on-close';

describe('console.resolve-on-close helpers', () => {
  it('extracts INC/REQ ticket numbers', () => {
    expect(extractTicketNumber('sobre o INC-20298.')).toBe('INC-20298');
    expect(extractTicketNumber('REQ-10442 · monitor')).toBe('REQ-10442');
    expect(extractTicketNumber('sem numero')).toBeNull();
  });

  it('prefers summary then most recent message mention', () => {
    expect(
      pickLinkedTicketNumber('quero suporte · INC-20298', ['INC-20311 · outro']),
    ).toBe('INC-20298');
    expect(
      pickLinkedTicketNumber('quero suporte', [
        'Você tem 3 chamados',
        'Entendido sobre o INC-20298.',
      ]),
    ).toBe('INC-20298');
  });
});
