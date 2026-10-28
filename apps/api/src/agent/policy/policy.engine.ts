import { Injectable } from '@nestjs/common';
import {
  decidePriority,
  detectDuplicity,
  enrichPriorityInputFromText,
  type DuplicateProbe,
} from '@nexo-assist/domain';
import type {
  AffectedScope,
  DuplicateCandidate,
  PriorityDecision,
  PriorityInput,
  TicketCategory,
} from '@nexo-assist/contracts';

export type DraftPriorityResolution = {
  readonly decision: PriorityDecision;
  readonly enriched: PriorityInput;
};

@Injectable()
export class PolicyEngine {
  decidePriorityFromDraft(payload: Record<string, unknown>): PriorityDecision {
    return this.resolvePriorityFromDraft(payload).decision;
  }

  resolvePriorityFromDraft(payload: Record<string, unknown>): DraftPriorityResolution {
    const text = [payload['title'], payload['description']]
      .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
      .join('\n');
    const enriched = enrichPriorityInputFromText(
      {
        affectedScope:
          (payload['affectedScope'] as AffectedScope | undefined) ?? 'unknown',
        workStopped: asNullableBoolean(payload['workStopped']),
        sameDayCommitment: asNullableBoolean(payload['sameDayCommitment']),
        hasAlternative: asNullableBoolean(payload['hasAlternative']),
      },
      text,
    );
    return { decision: decidePriority(enriched), enriched };
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
