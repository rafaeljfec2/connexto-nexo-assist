import { describe, expect, it } from 'vitest';
import {
  detailCardAgentContent,
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
