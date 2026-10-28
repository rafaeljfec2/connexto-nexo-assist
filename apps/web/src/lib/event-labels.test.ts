import { describe, expect, it } from 'vitest';
import { humanizeEvent } from './event-labels';

describe('humanizeEvent (Consulta chips)', () => {
  it('labels sla.compute_due as calculou o prazo on consulta', () => {
    expect(
      humanizeEvent({
        tool: null,
        rule: 'sla.compute_due',
        intent: 'consult',
        result: 'overdue',
        justification: 'Deadline passed',
      }),
    ).toBe('calculou o prazo');
  });

  it('labels sla.compute_due as consultou o SLA on draft create', () => {
    expect(
      humanizeEvent({
        tool: null,
        rule: 'sla.compute_due',
        intent: 'create',
        result: '2026-10-27T16:43:00.000Z',
        justification: 'SLA due date computed',
      }),
    ).toBe('consultou o SLA');
  });

  it('labels ticket.inspect with the ticket number', () => {
    expect(
      humanizeEvent({
        tool: null,
        rule: 'ticket.inspect',
        intent: 'consult',
        result: 'INC-20311',
        justification: 'Selected ticket INC-20311 detail loaded.',
      }),
    ).toBe('consultou o INC-20311');
  });

  it('labels get_ticket with the ticket number from result', () => {
    expect(
      humanizeEvent({
        tool: 'get_ticket',
        rule: null,
        intent: 'consult',
        result: 'INC-20311',
        justification: 'Inspected ticket INC-20311',
      }),
    ).toBe('consultou o INC-20311');
  });

  it('keeps list_my_tickets label', () => {
    expect(
      humanizeEvent({
        tool: 'list_my_tickets',
        rule: null,
        result: 'ok',
      }),
    ).toBe('consultou seus chamados');
  });

  it('humanizes confirm.button_confirm instead of raw rule', () => {
    expect(
      humanizeEvent({
        tool: null,
        rule: 'confirm.button_confirm',
        result: 'draft_confirmed',
        justification: 'Employee confirmed',
      }),
    ).toBe('confirmou o rascunho');
  });
});
