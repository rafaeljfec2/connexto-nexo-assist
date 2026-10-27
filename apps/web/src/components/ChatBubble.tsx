import type { ReactNode } from 'react';
import { cx } from '@/lib/ui';

type Role = 'employee' | 'agent' | 'analyst' | 'system';

type ChatBubbleProps = {
  role: Role;
  children: ReactNode;
  meta?: ReactNode;
  /** Employee bubbles default to end (sender). Console can force start. */
  align?: 'start' | 'end';
  /** Agent surface: plain matches employee Figma; tint matches console Figma. */
  agentStyle?: 'plain' | 'tint';
  /**
   * `employee` — dark employee bubbles (self-chat).
   * `console` — attendant view: client left/white, agent/analyst right/tint.
   */
  surface?: 'employee' | 'console';
  /** Optional timestamp rendered inside the bubble (Pencil console). */
  time?: string;
  className?: string;
  footer?: ReactNode;
};

export function ChatBubble({
  role,
  children,
  meta,
  align,
  agentStyle = 'plain',
  surface = 'employee',
  time,
  className,
  footer,
}: ChatBubbleProps) {
  if (role === 'system') {
    return (
      <div className={cx('flex items-center gap-3 py-2', className)}>
        <div className="h-px flex-1 bg-[rgba(27,36,49,0.08)]" />
        <p className="text-xs font-medium text-ink-3">{children}</p>
        <div className="h-px flex-1 bg-[rgba(27,36,49,0.08)]" />
      </div>
    );
  }

  const isConsole = surface === 'console';
  const resolvedAlign =
    align ??
    (isConsole
      ? role === 'employee'
        ? 'start'
        : 'end'
      : role === 'employee'
        ? 'end'
        : 'start');

  const agentBubble = isConsole
    ? 'rounded-[12px_4px_12px_12px] bg-[#E6EFFA] text-ink shadow-[0_1px_2px_rgba(27,36,49,0.07)]'
    : agentStyle === 'tint'
      ? 'rounded-[4px_12px_12px_12px] bg-[#E6EFFA] text-ink'
      : 'rounded-[4px_12px_12px_12px] border border-rule bg-paper text-ink shadow-sm';

  const bubbleClass = isConsole
    ? role === 'employee'
      ? 'rounded-[4px_12px_12px_12px] bg-paper text-ink shadow-[0_1px_2px_rgba(27,36,49,0.07)]'
      : role === 'analyst'
        ? 'rounded-[12px_4px_12px_12px] bg-[#E3F4EA] text-ink shadow-[0_1px_2px_rgba(27,36,49,0.07)]'
        : agentBubble
    : role === 'employee'
      ? 'rounded-[12px_4px_12px_12px] bg-ink text-white'
      : role === 'analyst'
        ? 'rounded-[4px_12px_12px_12px] border border-rule bg-[#E3F4EA] text-ink'
        : agentBubble;

  return (
    <div
      className={cx(
        'flex max-w-[85%] flex-col gap-1',
        resolvedAlign === 'end' ? 'ml-auto items-end' : 'items-start',
        className,
      )}
    >
      {meta}
      {isConsole ? (
        <div
          className={cx(
            'flex flex-row items-end gap-2.5 px-3 pb-1.5 pt-2 text-[14.5px] leading-[21px]',
            bubbleClass,
          )}
        >
          <div className="min-w-0 flex-1">
            {children}
            {footer}
          </div>
          {time ? <span className="shrink-0 pb-0.5 text-[11px] text-ink-3">{time}</span> : null}
        </div>
      ) : (
        <div className={cx('px-3.5 py-2.5 text-[14.5px] leading-relaxed', bubbleClass)}>
          {children}
          {footer}
        </div>
      )}
    </div>
  );
}
