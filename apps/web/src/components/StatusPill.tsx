import { cx } from '@/lib/ui';

type Tone = 'success' | 'warning' | 'danger' | 'neutral' | 'primary';

const tones: Record<Tone, string> = {
  success: 'bg-success-soft text-success-text',
  warning: 'bg-warning-soft text-warning-text',
  danger: 'bg-danger-soft text-danger-text',
  neutral: 'bg-desk text-ink-3',
  primary: 'bg-primary-soft text-primary-text',
};

type StatusPillProps = {
  label: string;
  tone?: Tone;
  dot?: boolean;
  className?: string;
};

export function StatusPill({ label, tone = 'neutral', dot = false, className }: StatusPillProps) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold',
        tones[tone],
        className,
      )}
    >
      {dot ? (
        <span
          className={cx(
            'h-1.5 w-1.5 rounded-full',
            tone === 'success'
              ? 'bg-success'
              : tone === 'warning'
                ? 'bg-warning'
                : tone === 'danger'
                  ? 'bg-danger'
                  : tone === 'primary'
                    ? 'bg-primary'
                    : 'bg-ink-3',
          )}
        />
      ) : null}
      {label}
    </span>
  );
}
