import { describe, expect, it } from 'vitest';
import { buildConsultaDetailReply, formatTicketStatusLabel } from './agent.tools';

describe('formatTicketStatusLabel', () => {
  it('maps waiting_analyst to Portuguese', () => {
    expect(formatTicketStatusLabel('waiting_analyst')).toBe('aguardando analista');
  });
});

describe('buildConsultaDetailReply', () => {
  it('does not leak raw status enums into the employee-facing reply', () => {
    const reply = buildConsultaDetailReply(
      {
        id: 't1',
        number: 'INC-20402',
        title: 'Draft confirm retry',
        description: 'same draft twice',
        status: 'waiting_analyst',
        priority: 'medium',
        category: 'software',
        dueAt: '2026-10-30T21:00:00.000Z',
        createdAt: '2026-10-27T21:57:00.000Z',
        updatedAt: '2026-10-27T21:57:00.000Z',
      },
      false,
    );
    expect(reply).toContain('aguardando analista');
    expect(reply).not.toContain('waiting_analyst');
  });
});
