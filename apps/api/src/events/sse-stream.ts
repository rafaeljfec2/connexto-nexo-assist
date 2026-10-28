import type { Response } from 'express';
import {
  ConversationEventsService,
  type ConversationEventRecord,
} from './conversation-events.service';
import { resolveSseAfterSeq } from './sse-after-seq';
import {
  initSseResponse,
  serializeConversationEvent,
  SSE_HEARTBEAT_MS,
  writeSseComment,
  writeSseEvent,
} from './sse.util';

export async function openConversationEventStream(input: {
  res: Response;
  events: ConversationEventsService;
  /** null = console hub (all conversations). */
  conversationId: string | null;
  lastEventIdHeader: string | undefined;
  /** EventSource cannot set Last-Event-ID on the first connect; clients pass afterSeq. */
  afterSeqQuery?: string | undefined;
}): Promise<void> {
  const afterSeqRaw = resolveSseAfterSeq(input.afterSeqQuery, input.lastEventIdHeader);
  if (afterSeqRaw === 'invalid') {
    input.res.status(400).json({ message: 'Last-Event-ID / afterSeq must be a non-negative integer' });
    return;
  }

  let afterSeq = afterSeqRaw;
  if (input.conversationId) {
    const last = await input.events.getLastEventSeq(input.conversationId);
    if (afterSeq > last) {
      afterSeq = last;
    }
  }

  initSseResponse(input.res);

  const seen = new Set<string>();
  let lastSent = afterSeq;
  let closed = false;
  let heartbeat: ReturnType<typeof setInterval> | null = null;
  let unsubscribe: (() => void) | null = null;

  const cleanup = (): void => {
    if (closed) {
      return;
    }
    closed = true;
    if (heartbeat) {
      clearInterval(heartbeat);
      heartbeat = null;
    }
    unsubscribe?.();
    unsubscribe = null;
  };

  const emit = (event: ConversationEventRecord): void => {
    if (closed) {
      return;
    }
    if (input.conversationId && event.conversationId !== input.conversationId) {
      return;
    }
    const key = `${event.conversationId}:${event.seq}`;
    if (seen.has(key)) {
      return;
    }
    if (input.conversationId && event.seq <= lastSent) {
      return;
    }
    seen.add(key);
    if (input.conversationId) {
      lastSent = Math.max(lastSent, event.seq);
    }
    const ok = writeSseEvent(input.res, {
      id: input.conversationId ? String(event.seq) : `${event.conversationId}:${event.seq}`,
      event: event.type,
      data: serializeConversationEvent(event),
    });
    if (!ok) {
      cleanup();
    }
  };

  const subscription = input.events.subscribe({
    conversationId: input.conversationId,
    onEvent: emit,
  });
  unsubscribe = subscription.unsubscribe;

  heartbeat = setInterval(() => {
    if (!closed) {
      const ok = writeSseComment(input.res, 'ping');
      if (!ok) {
        cleanup();
      }
    }
  }, SSE_HEARTBEAT_MS);

  input.res.on('close', cleanup);

  try {
    if (input.conversationId) {
      const { events: replayed, truncated } = await input.events.replay({
        conversationId: input.conversationId,
        afterSeq,
      });
      for (const event of replayed) {
        emit(event);
      }
      if (truncated) {
        const ok = writeSseEvent(input.res, {
          event: 'sync.required',
          data: {
            conversationId: input.conversationId,
            type: 'sync.required',
            version: 1,
            payload: { reason: 'replay_limit' },
          },
        });
        if (!ok) {
          cleanup();
          return;
        }
      }
      for (const event of subscription.drain(lastSent)) {
        emit(event);
      }
    }
  } catch (err) {
    cleanup();
    if (!input.res.headersSent) {
      input.res.status(500).json({ message: 'Failed to open event stream' });
      throw err;
    }
    // Headers already committed to SSE — do not rethrow into Nest JSON filters.
    input.res.end();
  }
}
