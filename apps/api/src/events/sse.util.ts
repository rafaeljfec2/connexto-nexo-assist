import type { Response } from 'express';
import type { ConversationEventRecord } from './conversation-events.service';

export const SSE_HEARTBEAT_MS = 15_000;

export function initSseResponse(res: Response): void {
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();
}

/** Returns false when the socket is closed or the write fails. */
export function writeSseEvent(
  res: Response,
  input: {
    id?: string | number;
    event?: string;
    data: unknown;
  },
): boolean {
  try {
    if (res.writableEnded || res.destroyed) {
      return false;
    }
    if (input.id !== undefined) {
      res.write(`id: ${input.id}\n`);
    }
    if (input.event) {
      res.write(`event: ${input.event}\n`);
    }
    const payload = typeof input.data === 'string' ? input.data : JSON.stringify(input.data);
    for (const line of payload.split('\n')) {
      res.write(`data: ${line}\n`);
    }
    res.write('\n');
    return true;
  } catch {
    return false;
  }
}

/** Returns false when the socket is closed or the write fails. */
export function writeSseComment(res: Response, comment: string): boolean {
  try {
    if (res.writableEnded || res.destroyed) {
      return false;
    }
    res.write(`: ${comment}\n\n`);
    return true;
  } catch {
    return false;
  }
}

export function serializeConversationEvent(event: ConversationEventRecord): Record<string, unknown> {
  return {
    id: event.id,
    conversationId: event.conversationId,
    seq: event.seq,
    type: event.type,
    version: event.version,
    payload: event.payload,
    createdAt: event.createdAt.toISOString(),
  };
}

export function parseLastEventId(raw: string | undefined): number | 'invalid' {
  if (raw === undefined || raw === '') {
    return 0;
  }
  if (!/^\d+$/.test(raw)) {
    return 'invalid';
  }
  return Number(raw);
}
