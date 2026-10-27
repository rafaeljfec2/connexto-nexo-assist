import type {
  DuplicateCandidate,
  DuplicateDecision,
  TicketCategory,
} from '@nexo-assist/contracts';

const STRONG_THRESHOLD = 0.5;
const AMBIGUOUS_THRESHOLD = 0.3;

export interface DuplicateProbe {
  readonly category: TicketCategory | null;
  readonly title: string;
  readonly description: string;
  readonly errorCode: string | null;
}

/**
 * Deterministic duplicate detection among unresolved tickets of the same owner.
 * Strong: same category (when known) AND (same error code OR token overlap >= 0.5).
 * Ambiguous: score in [0.3, 0.5).
 * Multiple strong candidates → multiple.
 */
export function detectDuplicity(
  probe: DuplicateProbe,
  openTickets: readonly DuplicateCandidate[],
): DuplicateDecision {
  const unresolved = openTickets.filter((t) => t.status !== 'resolved');
  const scored = unresolved
    .map((ticket) => ({ ticket, score: scoreCandidate(probe, ticket) }))
    .filter((row) => row.score >= AMBIGUOUS_THRESHOLD)
    .sort((a, b) => b.score - a.score);

  const strong = scored.filter((row) => row.score >= STRONG_THRESHOLD);

  if (strong.length > 1) {
    return {
      match: 'multiple',
      score: strong[0]?.score ?? 0,
      candidates: strong.map((s) => s.ticket),
      rule: 'duplicity.multiple_strong',
    };
  }

  if (strong.length === 1 && strong[0]) {
    return {
      match: 'strong',
      score: strong[0].score,
      candidates: [strong[0].ticket],
      rule: 'duplicity.strong_match',
    };
  }

  if (scored.length >= 1 && scored[0]) {
    return {
      match: 'ambiguous',
      score: scored[0].score,
      candidates: scored.map((s) => s.ticket),
      rule: 'duplicity.ambiguous_band',
    };
  }

  return {
    match: 'none',
    score: 0,
    candidates: [],
    rule: 'duplicity.none',
  };
}

export function scoreCandidate(
  probe: DuplicateProbe,
  ticket: DuplicateCandidate,
): number {
  if (probe.category !== null && probe.category !== ticket.category) {
    return 0;
  }

  const probeCode = normalizeCode(probe.errorCode);
  const ticketCode = normalizeCode(ticket.errorCode);
  if (probeCode && ticketCode && probeCode === ticketCode) {
    return 1;
  }

  const overlap = tokenOverlap(
    `${probe.title} ${probe.description}`,
    `${ticket.title} ${ticket.description}`,
  );

  if (probe.category !== null && probe.category === ticket.category) {
    return Math.max(overlap, overlap >= STRONG_THRESHOLD ? overlap : overlap);
  }

  return overlap;
}

export function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .split(/[^a-z0-9]+/u)
      .filter((t) => t.length >= 3),
  );
}

export function tokenOverlap(a: string, b: string): number {
  const left = tokenize(a);
  const right = tokenize(b);
  if (left.size === 0 || right.size === 0) {
    return 0;
  }
  let intersection = 0;
  for (const token of left) {
    if (right.has(token)) {
      intersection += 1;
    }
  }
  const union = new Set([...left, ...right]).size;
  return union === 0 ? 0 : intersection / union;
}

function normalizeCode(code: string | null): string | null {
  if (!code) {
    return null;
  }
  const trimmed = code.trim().toLowerCase();
  return trimmed.length === 0 ? null : trimmed;
}
