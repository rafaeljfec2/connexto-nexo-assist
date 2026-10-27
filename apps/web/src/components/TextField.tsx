import type { InputHTMLAttributes, ReactNode } from 'react';
import { cx } from '@/lib/ui';

type TextFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'prefix'> & {
  label?: string;
  labelAction?: ReactNode;
  prefixIcon?: ReactNode;
  suffix?: ReactNode;
  error?: string | null;
};

export function TextField({
  label,
  labelAction,
  prefixIcon,
  suffix,
  error,
  className,
  id,
  ...rest
}: TextFieldProps) {
  const inputId = id ?? rest.name;

  return (
    <div className="block w-full">
      {label || labelAction ? (
        <div className="mb-2 flex items-center justify-between gap-3">
          {label ? (
            <label htmlFor={inputId} className="text-[13.5px] font-medium text-ink">
              {label}
            </label>
          ) : (
            <span />
          )}
          {labelAction}
        </div>
      ) : null}
      <div
        className={cx(
          'flex h-11 items-center gap-2.5 rounded-lg border bg-paper px-3.5 shadow-input transition focus-within:border-cta focus-within:ring-1 focus-within:ring-cta',
          error ? 'border-danger' : 'border-[rgba(27,36,49,0.12)]',
          className,
        )}
      >
        {prefixIcon ? <span className="shrink-0 text-ink-3">{prefixIcon}</span> : null}
        <input
          id={inputId}
          className="min-w-0 flex-1 bg-transparent text-[14.5px] text-ink outline-none placeholder:text-ink-3 disabled:opacity-50"
          {...rest}
        />
        {suffix ? <span className="shrink-0">{suffix}</span> : null}
      </div>
      {error ? <span className="mt-1.5 block text-xs text-danger-text">{error}</span> : null}
    </div>
  );
}
