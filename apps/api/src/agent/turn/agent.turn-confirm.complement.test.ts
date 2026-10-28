import { describe, expect, it } from 'vitest';
import { parseAddInformationRequest } from './agent.turn-confirm';

describe('parseAddInformationRequest', () => {
  it('matches the Consulta C6 button phrase with ticket number', () => {
    expect(parseAddInformationRequest('Adicionar informação ao chamado INC-20311')).toEqual({
      ticketNumber: 'INC-20311',
    });
  });

  it('matches without accents', () => {
    expect(parseAddInformationRequest('Adicionar informacao ao chamado REQ-100')).toEqual({
      ticketNumber: 'REQ-100',
    });
  });

  it('ignores bare complementar (duplicity HITL collision)', () => {
    expect(parseAddInformationRequest('complementar')).toBeNull();
    expect(parseAddInformationRequest('Quero complementar o chamado')).toBeNull();
    expect(
      parseAddInformationRequest('Confirme se deseja complementar ou criar mesmo assim'),
    ).toBeNull();
  });

  it('ignores add-info without a ticket number', () => {
    expect(parseAddInformationRequest('Adicionar informação ao chamado')).toBeNull();
  });

  it('ignores unrelated messages', () => {
    expect(parseAddInformationRequest('Quem está sendo afetado?')).toBeNull();
    expect(parseAddInformationRequest('INC-20311 · Notebook lento')).toBeNull();
    expect(parseAddInformationRequest('Abrir chamado novo')).toBeNull();
  });
});
