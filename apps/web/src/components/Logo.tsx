type LogoProps = {
  variant?: 'light' | 'brand';
  size?: number;
  showWordmark?: boolean;
  className?: string;
};

/** Nexo mark from Identificação (desktop) Pencil frame. */
const MARK_PATH =
  'M21.763 0.24493l-3.374 1.687c-0.623 0.308-0.973 0.903-0.973 1.631l0 6.293-11.193-9.429c-0.623-0.469-1.372-0.553-2.03-0.245l-3.185 1.631c-0.651 0.322-1.008 0.924-1.008 1.673l0 15.218c0 1.477 1.526 2.289 2.716 1.785l3.073-1.617c0.693-0.322 1.057-0.952 1.057-1.722l0-7.7 11.732 10.591c0.602 0.546 1.421 0.679 2.086 0.364l2.786-1.505c0.602-0.315 0.938-0.931 0.938-1.68l0-15.288c0-1.463-1.505-2.275-2.625-1.687z';

export function Logo({
  variant = 'brand',
  size = 20,
  showWordmark = true,
  className = '',
}: LogoProps) {
  const markFill = variant === 'light' ? '#FFFFFF' : '#037AF6';
  const wordFill = variant === 'light' ? 'text-white' : 'text-ink';
  const height = Math.round((size * 20.639) / 24.388);

  return (
    <div className={`inline-flex items-center gap-2.5 ${className}`}>
      <svg
        width={size}
        height={height}
        viewBox="0 0 24.388 20.639"
        fill="none"
        aria-hidden
      >
        <path d={MARK_PATH} fill={markFill} />
      </svg>
      {showWordmark ? (
        <span
          className={`text-[17px] font-bold tracking-[-0.2px] ${wordFill}`}
        >
          Nexo Assist
        </span>
      ) : null}
    </div>
  );
}
