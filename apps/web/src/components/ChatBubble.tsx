import type { ReactNode } from 'react';
import { cx } from '@/lib/ui';

type Role = 'employee' | 'agent' | 'analyst' | 'system';

type ChatBubbleProps = {
  role: Role;
  children: ReactNode;
  meta?: ReactNode;
  /** Employee bubbles default to end (sender). Console can force start. */
  align?: 'start' | 'end';
  className?: string;
};

export function ChatBubble({ role, children, meta, align, className }: ChatBubbleProps) {
  if (role === 'system') {
    return (
      <div className={cx('flex items-center gap-3 py-2', className)}>
        <div className="h-px flex-1 bg-[rgba(27,36,49,0.08)]" />
        <p className="text-xs font-medium text-ink-3">{children}</p>
        <div className="h-px flex-1 bg-[rgba(27,36,49,0.08)]" />
      </div>
    );
  }

  const resolvedAlign = align ?? (role === 'employee' ? 'end' : 'start');
  const bubbleClass =
    role === 'employee'
      ? 'rounded-[12px_4px_12px_12px] bg-ink text-white'
      : role === 'analyst'
        ? 'rounded-[4px_12px_12px_12px] bg-[#E3F4EA] text-ink'
        : 'rounded-[4px_12px_12px_12px] bg-[#E6EFFA] text-ink';

  return (
    <div
      className={cx(
        'flex max-w-[85%] flex-col gap-1',
        resolvedAlign === 'end' ? 'ml-auto items-end' : 'items-start',
        className,
      )}
    >
      {meta}
      <div className={cx('px-3 py-2 text-[14.5px] leading-relaxed', bubbleClass)}>{children}</div>
    </div>
  );
}
