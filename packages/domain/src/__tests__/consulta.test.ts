import { describe, expect, it } from 'vitest';
import {
  CONSULTA_RULE_IDS,
  MEDIUM_SLA_BUSINESS_DAYS,
  buildOverdueConsultaPrompt,
  formatOpenedAtPt,
  formatPriorityPt,
  formatRelativeUpdatePt,
  formatShortDatePt,
  isTicketOverdue,
} from '../consulta.js';

describe('Consulta de chamado frozen rules (C1–C9)', () => {
  it('exposes exactly the nine SPEC rule ids', () => {
    expect([...CONSULTA_RULE_IDS]).toEqual([
      'C1',
      'C2',
      'C3',
      'C4',
      'C5',
      'C6',
      'C7',
      'C8',
      'C9',
    ]);
  });

  it('documents medium SLA as three business days (Annex A)', () => {
    expect(MEDIUM_SLA_BUSINESS_DAYS).toBe(3);
  });

  it('marks overdue when dueAt is past and status is not resolved (C5)', () => {
    const now = new Date('2026-10-27T15:00:00.000Z');
    expect(
      isTicketOverdue({
        dueAt: new Date('2026-10-27T13:00:00.000Z'),
        status: 'waiting_analyst',
        now,
      }),
    ).toBe(true);
    expect(
      isTicketOverdue({
        dueAt: new Date('2026-10-27T13:00:00.000Z'),
        status: 'resolved',
        now,
      }),
    ).toBe(false);
    expect(
      isTicketOverdue({
        dueAt: new Date('2026-10-28T15:00:00.000Z'),
        status: 'in_progress',
        now,
      }),
    ).toBe(false);
  });

  it('formats relative updatedAt in pt-BR (C5)', () => {
    const now = new Date('2026-10-27T15:00:00.000Z');
    expect(formatRelativeUpdatePt(new Date('2026-10-25T15:00:00.000Z'), now)).toBe('há 2 dias');
    expect(formatRelativeUpdatePt(new Date('2026-10-26T15:00:00.000Z'), now)).toBe('há 1 dia');
    expect(formatRelativeUpdatePt(new Date('2026-10-27T12:00:00.000Z'), now)).toBe('há 3 horas');
  });

  it('formats compact short dates (C3)', () => {
    const label = formatShortDatePt(new Date('2026-10-16T15:00:00.000Z'));
    expect(label.toLowerCase()).toMatch(/16/);
    expect(label.toLowerCase()).toMatch(/out/);
    expect(label.toLowerCase()).not.toMatch(/\bde\b/);
  });

  it('formats opened-at and priority like the prototype card (C5)', () => {
    expect(formatPriorityPt('medium')).toBe('Média');
    const opened = formatOpenedAtPt(new Date('2026-10-16T17:20:00.000Z'));
    expect(opened.toLowerCase()).toMatch(/16/);
    expect(opened).toMatch(/,/);
  });

  it('builds the overdue follow-up prompt (C5/C6)', () => {
    const now = new Date('2026-10-27T15:00:00.000Z');
    expect(
      buildOverdueConsultaPrompt({
        updatedAt: new Date('2026-10-22T15:00:00.000Z'),
        now,
      }),
    ).toBe(
      'Está sem atualização há 5 dias, acima do prazo de 3 dias úteis para prioridade média. Quer que eu chame um analista?',
    );
  });
});
