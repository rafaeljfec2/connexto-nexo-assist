import { describe, expect, it } from 'vitest';
import {
  canComplement,
  canReopen,
  canTransferTicket,
  nextStatusAfterReopen,
} from '../transitions.js';

describe('ticket transitions', () => {
  it('allows complement on approved (second monitor case)', () => {
    expect(canComplement('approved').allowed).toBe(true);
  });

  it('denies complement on resolved', () => {
    expect(canComplement('resolved').allowed).toBe(false);
  });

  it('allows reopen inside 7 days', () => {
    const resolvedAt = new Date('2026-10-20T10:00:00.000Z');
    const now = new Date('2026-10-24T10:00:00.000Z');
    const result = canReopen('resolved', resolvedAt, now);
    expect(result.allowed).toBe(true);
    expect(nextStatusAfterReopen()).toBe('waiting_analyst');
  });

  it('denies reopen outside 7 days', () => {
    const resolvedAt = new Date('2026-10-01T10:00:00.000Z');
    const now = new Date('2026-10-20T10:00:00.000Z');
    expect(canReopen('resolved', resolvedAt, now).allowed).toBe(false);
  });

  it('denies reopen when status is not resolved', () => {
    expect(canReopen('in_progress', null, new Date()).allowed).toBe(false);
  });

  it('allows transfer of open tickets', () => {
    expect(canTransferTicket('waiting_analyst').allowed).toBe(true);
  });

  it('denies transfer of resolved tickets', () => {
    expect(canTransferTicket('resolved').allowed).toBe(false);
  });
});
