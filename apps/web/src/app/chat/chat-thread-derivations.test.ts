import { describe, expect, it } from 'vitest';
import {
  detailCardAgentContent,
  findTicketPickerAnchorIndexes,
  looksLikeOverdueConsultaPrompt,
  looksLikeTicketEnumeration,
  resolveSelectedTicketId,
  ticketPickerIntroContent,
} from './chat-thread-derivations';
import type { TicketRow } from './chat-helpers';

const ticket: TicketRow = {
  id: 't1',
  number: 'INC-20311',
  title: 'Notebook lento',
  status: 'waiting_analyst',
  priority: 'medium',
  category: 'hardware',
  description: 'Lentidão',
  dueAt: '2026-10-20T00:00:00.000Z',
  createdAt: '2026-10-16T14:20:00.000Z',
  updatedAt: '2026-10-22T14:20:00.000Z',
};

describe('ticketPickerIntroContent', () => {
  it('keeps Figma short intro without enumerating tickets', () => {
    expect(ticketPickerIntroContent(3)).toBe(
      'Você tem 3 chamados abertos. Sobre qual deles quer saber?',
    );
    expect(ticketPickerIntroContent(1)).toBe(
      'Você tem 1 chamado aberto. Sobre qual deles quer saber?',
    );
  });
});

describe('looksLikeTicketEnumeration', () => {
  it('detects multi-ticket LLM dumps', () => {
    expect(
      looksLikeTicketEnumeration(
        'Encontrei 2 chamados:\n1. INC-20311: x\n2. INC-20298: y',
      ),
    ).toBe(true);
    expect(looksLikeTicketEnumeration('Você tem 3 chamados abertos. Sobre qual?')).toBe(
      false,
    );
  });
});

describe('Figma consulta picker anchors', () => {
  it('places a picker under every list intro reply', () => {
    const indexes = findTicketPickerAnchorIndexes([
      {
        id: '1',
        role: 'employee',
        content: 'Qual o status do meu chamado?',
        createdAt: new Date().toISOString(),
      },
      {
        id: '2',
        role: 'agent',
        content: 'Você tem 3 chamados abertos. Sobre qual deles quer saber?',
        createdAt: new Date().toISOString(),
      },
      {
        id: '3',
        role: 'employee',
        content: 'INC-20311 · Notebook lento após atualização',
        createdAt: new Date().toISOString(),
      },
      {
        id: '4',
        role: 'employee',
        content: 'Quero saber do meus chamados',
        createdAt: new Date().toISOString(),
      },
      {
        id: '5',
        role: 'agent',
        content: 'Você tem 4 chamados abertos. Sobre qual deles quer saber?',
        createdAt: new Date().toISOString(),
      },
    ]);
    expect(indexes).toEqual([1, 4]);
  });

  it('resolves selected ticket from selection message when state was cleared', () => {
    expect(
      resolveSelectedTicketId({
        selectedTicketId: null,
        detailTicket: null,
        messages: [
          {
            id: '3',
            role: 'employee',
            content: 'INC-20311 · Notebook lento após atualização',
            createdAt: new Date().toISOString(),
          },
        ],
        openTickets: [ticket],
      }),
    ).toBe('t1');
  });
});

describe('detailCardAgentContent', () => {
  it('omits redundant Consultei text when ticket is not overdue', () => {
    expect(
      detailCardAgentContent({
        lastAgentMessage: {
          id: 'm1',
          role: 'agent',
          content:
            'Consultei o INC-20311 (Notebook lento). Status atual: aguardando analista.',
          createdAt: new Date().toISOString(),
        },
        overdue: false,
        detailTicket: ticket,
      }),
    ).toBeNull();
  });

  it('uses overdue prompt instead of Consultei dump when overdue', () => {
    const content = detailCardAgentContent({
      lastAgentMessage: {
        id: 'm1',
        role: 'agent',
        content:
          'Consultei o INC-20311 (Notebook lento). Status atual: aguardando analista.',
        createdAt: new Date().toISOString(),
      },
      overdue: true,
      detailTicket: ticket,
    });
    expect(content).toBeTruthy();
    expect(content).toMatch(/sem atualização/i);
    expect(content).not.toMatch(/Consultei/i);
  });
});

describe('looksLikeOverdueConsultaPrompt', () => {
  it('detects the overdue follow-up so the agent bubble can be suppressed under the card', () => {
    expect(
      looksLikeOverdueConsultaPrompt(
        'Está sem atualização há 5 dias, acima do prazo de 3 dias úteis para prioridade média. Quer que eu chame um analista?',
      ),
    ).toBe(true);
    expect(
      looksLikeOverdueConsultaPrompt(
        'Consultei o INC-20311 (Notebook lento). Status atual: aguardando analista.',
      ),
    ).toBe(false);
  });
});
