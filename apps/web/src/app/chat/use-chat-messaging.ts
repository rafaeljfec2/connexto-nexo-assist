import { useCallback, useRef, useState, type MutableRefObject } from 'react';
import { api, ApiError, type ConversationPayload, type ExecutionEvent } from '@/lib/api';
import { newClientMessageId } from '@/lib/sse';
import { CLIENT_TURN_TIMEOUT_MS, groupEventsByExecution, mapTickets, type TicketRow } from './chat-helpers';

export type UseChatMessagingResult = {
  sending: boolean;
  error: string | null;
  setError: (value: string | null) => void;
  incompleteHint: string | null;
  retryContent: string | null;
  pendingExecutionId: string | null;
  pendingExecutionRef: MutableRefObject<string | null>;
  clearTurnTimer: () => void;
  onAgentIncompleteOrFailed: () => void;
  onAgentCompleted: () => void;
  refresh: () => Promise<void>;
  reloadTickets: () => Promise<void>;
  sendContent: (content: string, options?: { reuseClientMessageId?: boolean }) => Promise<void>;
  retryIncompleteTurn: () => Promise<void>;
  onConfirmDraft: (confirm: boolean) => Promise<void>;
};

export function useChatMessaging(input: {
  payload: ConversationPayload | null;
  inputLocked: boolean;
  stickToBottomRef: MutableRefObject<boolean>;
  setShowNewMessageCue: (value: boolean) => void;
  setPayload: (payload: ConversationPayload) => void;
  setTurnEvents: (events: Record<string, ExecutionEvent[]>) => void;
  setTickets: (tickets: TicketRow[]) => void;
  setInput: (value: string) => void;
  onSendStart: () => void;
}): UseChatMessagingResult {
  const {
    payload,
    inputLocked,
    stickToBottomRef,
    setShowNewMessageCue,
    setPayload,
    setTurnEvents,
    setTickets,
    setInput,
    onSendStart,
  } = input;

  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [incompleteHint, setIncompleteHint] = useState<string | null>(null);
  const [retryContent, setRetryContent] = useState<string | null>(null);
  const [pendingExecutionId, setPendingExecutionId] = useState<string | null>(null);

  const lastClientMessageIdRef = useRef<string | null>(null);
  const pendingExecutionRef = useRef<string | null>(null);
  const turnTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTurnTimer = useCallback(() => {
    if (turnTimerRef.current) {
      clearTimeout(turnTimerRef.current);
      turnTimerRef.current = null;
    }
  }, []);

  const onAgentIncompleteOrFailed = useCallback(() => {
    setIncompleteHint('Não concluído — tentar novamente.');
    setSending(false);
    setPendingExecutionId(null);
    pendingExecutionRef.current = null;
  }, []);

  const onAgentCompleted = useCallback(() => {
    setIncompleteHint(null);
    setRetryContent(null);
    setSending(false);
    setPendingExecutionId(null);
    pendingExecutionRef.current = null;
  }, []);

  const refresh = useCallback(async () => {
    const conversation = await api.currentConversation();
    setPayload(conversation);
    setTurnEvents(groupEventsByExecution(conversation.events));
  }, [setPayload, setTurnEvents]);

  const reloadTickets = useCallback(async () => {
    setTickets(mapTickets(await api.listTickets()));
  }, [setTickets]);

  const sendContent = useCallback(
    async (content: string, options?: { reuseClientMessageId?: boolean }) => {
      if (!content.trim() || sending || inputLocked) {
        return;
      }
      stickToBottomRef.current = true;
      setShowNewMessageCue(false);
      setSending(true);
      setError(null);
      setIncompleteHint(null);
      setInput('');
      onSendStart();
      setRetryContent(content.trim());

      const clientMessageId =
        options?.reuseClientMessageId && lastClientMessageIdRef.current
          ? lastClientMessageIdRef.current
          : newClientMessageId();
      lastClientMessageIdRef.current = clientMessageId;

      try {
        const result = await api.sendMessage(content.trim(), clientMessageId);
        await refresh();
        if (!result.executionId) {
          setSending(false);
          setRetryContent(null);
          return;
        }
        setPendingExecutionId(result.executionId);
        pendingExecutionRef.current = result.executionId;
        clearTurnTimer();
        turnTimerRef.current = setTimeout(() => {
          if (pendingExecutionRef.current === result.executionId) {
            setIncompleteHint('Não concluído — tentar novamente.');
            setSending(false);
            setPendingExecutionId(null);
            pendingExecutionRef.current = null;
          }
        }, CLIENT_TURN_TIMEOUT_MS);
      } catch (err) {
        if (err instanceof ApiError && err.status === 503) {
          setError(
            err.message ||
              'O sistema de chamados está temporariamente indisponível. Tente novamente em instantes.',
          );
        } else {
          setError(err instanceof ApiError ? err.message : 'Falha ao enviar mensagem');
        }
        setSending(false);
      }
    },
    [
      sending,
      inputLocked,
      stickToBottomRef,
      setShowNewMessageCue,
      setInput,
      onSendStart,
      refresh,
      clearTurnTimer,
    ],
  );

  const retryIncompleteTurn = useCallback(async () => {
    if (!retryContent) {
      return;
    }
    const reuse = Boolean(error && lastClientMessageIdRef.current);
    lastClientMessageIdRef.current = reuse ? lastClientMessageIdRef.current : null;
    setError(null);
    setIncompleteHint(null);
    await sendContent(retryContent, { reuseClientMessageId: reuse });
  }, [retryContent, error, sendContent]);

  const onConfirmDraft = useCallback(
    async (confirm: boolean) => {
      if (!payload?.draft) {
        return;
      }
      stickToBottomRef.current = true;
      setShowNewMessageCue(false);
      setSending(true);
      try {
        await api.confirmDraft(payload.draft.id, payload.draft.version, confirm);
        await refresh();
        await reloadTickets();
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Falha ao confirmar rascunho');
      } finally {
        setSending(false);
      }
    },
    [payload?.draft, stickToBottomRef, setShowNewMessageCue, refresh, reloadTickets],
  );

  return {
    sending,
    error,
    setError,
    incompleteHint,
    retryContent,
    pendingExecutionId,
    pendingExecutionRef,
    clearTurnTimer,
    onAgentIncompleteOrFailed,
    onAgentCompleted,
    refresh,
    reloadTickets,
    sendContent,
    retryIncompleteTurn,
    onConfirmDraft,
  };
}
