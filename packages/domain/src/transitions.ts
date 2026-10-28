import type { TicketStatus } from '@nexo-assist/contracts';
import { isWithinReopenWindow } from './sla';

const COMPLEMENTABLE: ReadonlySet<TicketStatus> = new Set([
  'waiting_analyst',
  'in_progress',
  'approved',
]);

export type TransitionResult =
  | { readonly allowed: true; readonly rule: string }
  | { readonly allowed: false; readonly rule: string; readonly reason: string };

export function canComplement(status: TicketStatus): TransitionResult {
  if (COMPLEMENTABLE.has(status)) {
    return { allowed: true, rule: 'transition.complement_allowed' };
  }
  return {
    allowed: false,
    rule: 'transition.complement_denied',
    reason: 'Only waiting_analyst, in_progress, and approved tickets accept complements.',
  };
}

export function canReopen(
  status: TicketStatus,
  resolvedAt: Date | null,
  now: Date,
): TransitionResult {
  if (status !== 'resolved') {
    return {
      allowed: false,
      rule: 'transition.reopen_not_resolved',
      reason: 'Only resolved tickets can be reopened.',
    };
  }
  if (resolvedAt === null) {
    return {
      allowed: false,
      rule: 'transition.reopen_missing_resolved_at',
      reason: 'Resolved ticket is missing resolvedAt.',
    };
  }
  if (!isWithinReopenWindow(resolvedAt, now)) {
    return {
      allowed: false,
      rule: 'transition.reopen_outside_window',
      reason: 'Reopen window of 7 days (168 hours) has expired.',
    };
  }
  return { allowed: true, rule: 'transition.reopen_allowed' };
}

export function nextStatusAfterReopen(): TicketStatus {
  return 'waiting_analyst';
}

export function canTransferTicket(status: TicketStatus): TransitionResult {
  if (status === 'resolved') {
    return {
      allowed: false,
      rule: 'transition.transfer_resolved_denied',
      reason: 'Resolved tickets are not transferred; reopen first if needed.',
    };
  }
  return { allowed: true, rule: 'transition.transfer_allowed' };
}

export function statusAfterTransfer(): TicketStatus {
  return 'transferred';
}

const RESOLVABLE: ReadonlySet<TicketStatus> = new Set([
  'waiting_analyst',
  'in_progress',
  'approved',
  'transferred',
]);

export function canResolve(status: TicketStatus): TransitionResult {
  if (RESOLVABLE.has(status)) {
    return { allowed: true, rule: 'transition.resolve_allowed' };
  }
  return {
    allowed: false,
    rule: 'transition.resolve_denied',
    reason: 'Only open tickets can be resolved.',
  };
}
