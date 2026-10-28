const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export type SseConversationEvent = {
  id?: string;
  conversationId: string;
  seq: number;
  type: string;
  version: number;
  payload: Record<string, unknown>;
  createdAt: string;
};

export type ConversationSseHandlers = {
  onEvent: (event: SseConversationEvent) => void;
  onError?: (err: Event) => void;
  onSyncRequired?: () => void;
};

/**
 * Subscribe to conversation SSE with at-least-once delivery.
 * Caller dedupes by seq; this helper also skips duplicates it already emitted.
 */
export function subscribeConversationEvents(
  conversationId: string,
  afterSeq: number,
  handlers: ConversationSseHandlers,
): { close: () => void } {
  const seen = new Set<number>();
  let lastSeq = afterSeq;
  let closed = false;
  let source: EventSource | null = null;

  const url = new URL(`${API_BASE}/conversations/${conversationId}/events`);
  if (afterSeq > 0) {
    url.searchParams.set('afterSeq', String(afterSeq));
  }
  source = new EventSource(url.toString(), { withCredentials: true });

  // EventSource reconnects with Last-Event-ID automatically when the browser supports it.
  // We also track seq locally for dedupe across reconnect gaps handled by the server replay.
  const handlePayload = (raw: MessageEvent): void => {
    if (closed) {
      return;
    }
    if (raw.type === 'sync.required' || (typeof raw.data === 'string' && raw.data.includes('sync.required'))) {
      handlers.onSyncRequired?.();
    }
    try {
      const parsed = JSON.parse(String(raw.data)) as SseConversationEvent;
      if (parsed.type === 'sync.required') {
        handlers.onSyncRequired?.();
        return;
      }
      if (typeof parsed.seq !== 'number') {
        return;
      }
      if (seen.has(parsed.seq) || parsed.seq <= lastSeq) {
        return;
      }
      seen.add(parsed.seq);
      lastSeq = parsed.seq;
      handlers.onEvent(parsed);
    } catch {
      // ignore malformed frames
    }
  };

  source.onmessage = handlePayload;
  for (const type of [
    'message.created',
    'agent.started',
    'agent.completed',
    'agent.failed',
    'agent.incomplete',
    'conversation.updated',
    'sync.required',
  ]) {
    source.addEventListener(type, handlePayload as EventListener);
  }

  source.onerror = (err) => {
    handlers.onError?.(err);
  };

  return {
    close: () => {
      closed = true;
      source?.close();
      source = null;
    },
  };
}

export function subscribeConsoleEvents(
  conversationId: string | null,
  afterSeq: number,
  handlers: ConversationSseHandlers,
): { close: () => void } {
  const seen = new Set<string>();
  let closed = false;
  const url = new URL(`${API_BASE}/console/events`);
  if (conversationId) {
    url.searchParams.set('conversationId', conversationId);
    if (afterSeq > 0) {
      url.searchParams.set('afterSeq', String(afterSeq));
    }
  }
  const source = new EventSource(url.toString(), { withCredentials: true });

  const handlePayload = (raw: MessageEvent): void => {
    if (closed) {
      return;
    }
    try {
      const parsed = JSON.parse(String(raw.data)) as SseConversationEvent;
      if (parsed.type === 'sync.required') {
        handlers.onSyncRequired?.();
        return;
      }
      if (typeof parsed.seq !== 'number' || !parsed.conversationId) {
        return;
      }
      if (conversationId && parsed.seq <= afterSeq) {
        const key = `${parsed.conversationId}:${parsed.seq}`;
        if (seen.has(key)) {
          return;
        }
      }
      const key = `${parsed.conversationId}:${parsed.seq}`;
      if (seen.has(key)) {
        return;
      }
      seen.add(key);
      handlers.onEvent(parsed);
    } catch {
      // ignore
    }
  };

  source.onmessage = handlePayload;
  for (const type of [
    'message.created',
    'agent.started',
    'agent.completed',
    'agent.failed',
    'agent.incomplete',
    'conversation.updated',
    'sync.required',
  ]) {
    source.addEventListener(type, handlePayload as EventListener);
  }
  source.onerror = (err) => {
    handlers.onError?.(err);
  };

  return {
    close: () => {
      closed = true;
      source.close();
    },
  };
}

export function newClientMessageId(): string {
  return crypto.randomUUID();
}
