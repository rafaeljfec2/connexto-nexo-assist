import { useEffect, useRef, useState, type MutableRefObject, type RefObject } from 'react';
import type { ConversationPayload, User } from '@/lib/api';
import { NEAR_BOTTOM_PX } from './chat-helpers';

function isNearBottom(el: HTMLDivElement): boolean {
  return el.scrollHeight - el.scrollTop - el.clientHeight <= NEAR_BOTTOM_PX;
}

export type UseChatScrollResult = {
  scrollRef: RefObject<HTMLDivElement | null>;
  threadContentRef: RefObject<HTMLDivElement | null>;
  showNewMessageCue: boolean;
  setShowNewMessageCue: (value: boolean) => void;
  stickToBottomRef: RefObject<boolean>;
  scrollToBottom: (behavior?: ScrollBehavior) => void;
  onThreadScroll: () => void;
};

export function useChatScroll(input: {
  loading: boolean;
  user: User | null;
  payload: ConversationPayload | null;
  sending: boolean;
  ticketsLength: number;
  stickToBottomRef: MutableRefObject<boolean>;
}): UseChatScrollResult {
  const { loading, user, payload, sending, ticketsLength, stickToBottomRef } = input;
  const scrollRef = useRef<HTMLDivElement>(null);
  const threadContentRef = useRef<HTMLDivElement>(null);
  const nearBottomRef = useRef(true);
  const prevMessageCountRef = useRef(0);
  const prevScrollHeightRef = useRef(0);
  const [showNewMessageCue, setShowNewMessageCue] = useState(false);

  const threadFingerprint = [
    payload?.messages.length ?? 0,
    payload?.messages.at(-1)?.id ?? '',
    payload?.draft?.id ?? '',
    payload?.events.at(-1)?.executionId ?? '',
    ticketsLength,
    sending ? 'sending' : 'idle',
  ].join('|');

  function scrollToBottom(behavior: ScrollBehavior = 'smooth') {
    const el = scrollRef.current;
    if (!el) {
      return;
    }
    el.scrollTo({ top: el.scrollHeight, behavior });
    nearBottomRef.current = true;
    stickToBottomRef.current = true;
    setShowNewMessageCue(false);
  }

  function onThreadScroll() {
    const el = scrollRef.current;
    if (!el) {
      return;
    }
    const near = isNearBottom(el);
    nearBottomRef.current = near;
    stickToBottomRef.current = near;
    if (near) {
      setShowNewMessageCue(false);
    }
  }

  useEffect(() => {
    if (loading) {
      return;
    }
    const scroller = scrollRef.current;
    const content = threadContentRef.current;
    if (!scroller || !content) {
      return;
    }

    prevScrollHeightRef.current = scroller.scrollHeight;

    const syncToGrowth = () => {
      const nextHeight = scroller.scrollHeight;
      const grew = nextHeight > prevScrollHeightRef.current + 1;
      prevScrollHeightRef.current = nextHeight;
      if (!grew) {
        return;
      }
      if (stickToBottomRef.current || nearBottomRef.current) {
        scroller.scrollTop = scroller.scrollHeight;
        nearBottomRef.current = true;
        stickToBottomRef.current = true;
        setShowNewMessageCue(false);
        return;
      }
      setShowNewMessageCue(true);
    };

    const observer = new ResizeObserver(() => {
      syncToGrowth();
    });
    observer.observe(content);
    return () => observer.disconnect();
  }, [loading, user]);

  useEffect(() => {
    if (loading || !payload) {
      return;
    }
    const messageCount = payload.messages.length;
    const previousCount = prevMessageCountRef.current;
    const grew = messageCount > previousCount;
    prevMessageCountRef.current = messageCount;

    const shouldStick = stickToBottomRef.current || nearBottomRef.current;
    if (shouldStick) {
      const behavior: ScrollBehavior =
        previousCount === 0 ? 'auto' : 'smooth';
      const frame = window.requestAnimationFrame(() => {
        scrollToBottom(behavior);
      });
      return () => window.cancelAnimationFrame(frame);
    }

    if (grew) {
      setShowNewMessageCue(true);
    }
  }, [threadFingerprint, loading, payload]);

  return {
    scrollRef,
    threadContentRef,
    showNewMessageCue,
    setShowNewMessageCue,
    stickToBottomRef,
    scrollToBottom,
    onThreadScroll,
  };
}
