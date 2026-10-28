import { parseLastEventId } from './sse.util';

/**
 * Resolve replay cursor from optional query `afterSeq` and `Last-Event-ID`.
 * When both are present and numeric, use the max (reconnect advances via header).
 */
export function resolveSseAfterSeq(
  afterSeqQuery: string | undefined,
  lastEventIdHeader: string | undefined,
): number | 'invalid' {
  const hasQuery = afterSeqQuery !== undefined && afterSeqQuery !== '';
  const hasHeader = lastEventIdHeader !== undefined && lastEventIdHeader !== '';

  const fromQuery = hasQuery ? parseLastEventId(afterSeqQuery) : undefined;
  const fromHeader = hasHeader ? parseLastEventId(lastEventIdHeader) : undefined;

  if (fromQuery === 'invalid' || fromHeader === 'invalid') {
    return 'invalid';
  }

  if (fromQuery === undefined && fromHeader === undefined) {
    return 0;
  }
  if (fromQuery === undefined) {
    return fromHeader ?? 0;
  }
  if (fromHeader === undefined) {
    return fromQuery;
  }
  return Math.max(fromQuery, fromHeader);
}
