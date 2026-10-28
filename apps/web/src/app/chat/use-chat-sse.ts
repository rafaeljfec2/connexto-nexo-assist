import { useEffect, useRef, type MutableRefObject } from 'react';
import { subscribeConversationEvents } from '@/lib/sse';

export type ChatSseCallbacks = {
  clearTurnTimer: () => void;
  onAgentIncompleteOrFailed: () => void;
  onAgentCompleted: () => void;
  refresh: () => void | Promise<void>;
  reloadTickets: () => void | Promise<void>;
};

export function useChatSse(
  conversationId: string | undefined,
  afterSeq: number,
  pendingExecutionRef: MutableRefObject<string | null>,
  callbacks: ChatSseCallbacks,
): void {
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;

  useEffect(() => {
    if (!conversationId) {
      return;
    }
    const sub = subscribeConversationEvents(conversationId, afterSeq, {
      onEvent: (event) => {
        const executionId =
          typeof event.payload['executionId'] === 'string'
            ? event.payload['executionId']
            : null;
        if (
          event.type === 'agent.completed' ||
          event.type === 'agent.failed' ||
          event.type === 'agent.incomplete' ||
          (event.type === 'message.created' && event.payload['role'] === 'agent')
        ) {
          if (
            !executionId ||
            executionId === pendingExecutionRef.current ||
            pendingExecutionRef.current
          ) {
            callbacksRef.current.clearTurnTimer();
            if (
              event.type === 'agent.incomplete' ||
              event.type === 'agent.failed'
            ) {
              callbacksRef.current.onAgentIncompleteOrFailed();
            } else if (
              event.type === 'agent.completed' ||
              (event.type === 'message.created' && event.payload['role'] === 'agent')
            ) {
              callbacksRef.current.onAgentCompleted();
            }
          }
          void callbacksRef.current.refresh();
          void callbacksRef.current.reloadTickets();
        } else if (event.type === 'conversation.updated' || event.type === 'message.created') {
          void callbacksRef.current.refresh();
        }
      },
      onSyncRequired: () => {
        void callbacksRef.current.refresh();
      },
    });
    return () => sub.close();
  }, [conversationId, afterSeq, pendingExecutionRef]);
}
