import { Injectable } from '@nestjs/common';
import {
  decidePriority,
  detectDuplicity,
  type DuplicateProbe,
} from '@nexo-assist/domain';
import type {
  AffectedScope,
  DuplicateCandidate,
  PriorityDecision,
  TicketCategory,
} from '@nexo-assist/contracts';

@Injectable()
export class PolicyEngine {
  decidePriorityFromDraft(payload: Record<string, unknown>): PriorityDecision {
    return decidePriority({
      affectedScope: (payload['affectedScope'] as AffectedScope | undefined) ?? 'unknown',
      workStopped: asNullableBoolean(payload['workStopped']),
      sameDayCommitment: asNullableBoolean(payload['sameDayCommitment']),
      hasAlternative: asNullableBoolean(payload['hasAlternative']),
    });
  }

  detectDuplicates(
    probe: DuplicateProbe,
    openTickets: readonly DuplicateCandidate[],
  ) {
    return detectDuplicity(probe, openTickets);
  }
}

function asNullableBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') {
    return value;
  }
  return null;
}

export function toDuplicateCandidates(
  rows: Array<{
    id: string;
    number: string;
    category: string;
    title: string;
    description: string;
    errorCode: string | null;
    status: string;
  }>,
): DuplicateCandidate[] {
  return rows.map((r) => ({
    ticketId: r.id,
    number: r.number,
    category: r.category as TicketCategory,
    title: r.title,
    description: r.description,
    errorCode: r.errorCode,
    status: r.status as DuplicateCandidate['status'],
  }));
}
