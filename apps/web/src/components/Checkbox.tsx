import type { InputHTMLAttributes } from 'react';
import { CheckIcon } from '@/components/icons';
import { cx } from '@/lib/ui';

type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  label: string;
};

export function Checkbox({ label, className, checked, ...rest }: CheckboxProps) {
  return (
    <label className={cx('inline-flex cursor-pointer items-center gap-2.5 text-[13.5px] text-ink-2', className)}>
      <span className="relative inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center">
        <input
          type="checkbox"
          className="peer absolute inset-0 cursor-pointer opacity-0"
          checked={checked}
          {...rest}
        />
        <span
          className={cx(
            'pointer-events-none flex h-full w-full items-center justify-center rounded-md border transition peer-focus-visible:ring-2 peer-focus-visible:ring-cta peer-focus-visible:ring-offset-2',
            checked
              ? 'border-cta bg-cta text-white'
              : 'border-[rgba(27,36,49,0.18)] bg-paper',
          )}
        >
          {checked ? <CheckIcon width={12} height={12} /> : null}
        </span>
      </span>
      {label}
    </label>
  );
}
