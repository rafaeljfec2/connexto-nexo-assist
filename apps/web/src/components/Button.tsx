import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cx } from '@/lib/ui';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'dangerSoft';

const variants: Record<Variant, string> = {
  primary: 'bg-cta text-white hover:bg-cta-hover',
  secondary: 'bg-desk text-ink-2 hover:bg-mist-100',
  ghost: 'bg-transparent text-ink-2 hover:bg-desk',
  danger: 'bg-danger text-white hover:brightness-110',
  dangerSoft: 'bg-danger-soft text-danger-text hover:brightness-95',
};

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
};

export function Button({
  variant = 'primary',
  leadingIcon,
  trailingIcon,
  className,
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cx(
        'inline-flex h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50',
        variants[variant],
        className,
      )}
      {...rest}
    >
      {leadingIcon}
      {children}
      {trailingIcon}
    </button>
  );
}
