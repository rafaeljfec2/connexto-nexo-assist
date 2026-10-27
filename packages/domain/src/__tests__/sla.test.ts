import { describe, expect, it } from 'vitest';
import { addBusinessHours, computeDueAt, isWithinReopenWindow } from '../sla.js';

describe('computeDueAt', () => {
  it('adds one calendar hour for critical priority', () => {
    const from = new Date('2026-10-24T22:00:00.000Z');
    const due = computeDueAt('critical', from);
    expect(due.getTime() - from.getTime()).toBe(60 * 60 * 1000);
  });

  it('adds 4 business hours for high priority inside a weekday', () => {
    // Monday 10:00 America/Sao_Paulo = 13:00 UTC (BRT, no DST in 2026)
    const from = new Date('2026-10-26T13:00:00.000Z');
    const due = computeDueAt('high', from);
    // 10:00 + 4h = 14:00 BRT = 17:00 UTC
    expect(due.toISOString()).toBe('2026-10-26T17:00:00.000Z');
  });

  it('skips weekend when adding medium SLA hours', () => {
    // Friday 16:00 BRT = 19:00 UTC; 30 business hours should land next week
    const from = new Date('2026-10-23T19:00:00.000Z');
    const due = addBusinessHours(from, 30);
    expect(due.getUTCDay()).not.toBe(0);
    expect(due.getUTCDay()).not.toBe(6);
    expect(due.getTime()).toBeGreaterThan(from.getTime());
  });

  it('recalculates due from the update instant', () => {
    const first = computeDueAt('high', new Date('2026-10-26T13:00:00.000Z'));
    const second = computeDueAt('high', new Date('2026-10-26T15:00:00.000Z'));
    expect(second.getTime()).toBeGreaterThan(first.getTime());
  });
});

describe('isWithinReopenWindow', () => {
  it('includes the exact 168th hour', () => {
    const resolvedAt = new Date('2026-10-01T12:00:00.000Z');
    const now = new Date('2026-10-08T12:00:00.000Z');
    expect(isWithinReopenWindow(resolvedAt, now)).toBe(true);
  });

  it('excludes one millisecond after 168 hours', () => {
    const resolvedAt = new Date('2026-10-01T12:00:00.000Z');
    const now = new Date('2026-10-08T12:00:00.001Z');
    expect(isWithinReopenWindow(resolvedAt, now)).toBe(false);
  });
});
