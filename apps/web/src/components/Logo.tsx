type LogoProps = {
  variant?: 'light' | 'brand';
  size?: number;
  showWordmark?: boolean;
  className?: string;
};

export function Logo({
  variant = 'brand',
  size = 20,
  showWordmark = true,
  className = '',
}: LogoProps) {
  const markFill = variant === 'light' ? '#FFFFFF' : '#037AF6';
  const wordFill = variant === 'light' ? 'text-white' : 'text-ink';

  return (
    <div className={`inline-flex items-center gap-2.5 ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 21"
        fill="none"
        aria-hidden
      >
        <path
          d="M2.2 20.2V0.8h5.4L14.2 12.4V0.8h5.6v19.4h-5.4L7.8 8.6v11.6H2.2Z"
          fill={markFill}
        />
      </svg>
      {showWordmark ? (
        <span className={`text-base font-bold tracking-tight ${wordFill}`}>Nexo Assist</span>
      ) : null}
    </div>
  );
}
