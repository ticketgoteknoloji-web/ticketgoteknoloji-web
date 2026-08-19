import Link from 'next/link';

type BrandLogoProps = {
  variant?: 'header' | 'footer';
};

export function BrandLogo({ variant = 'header' }: BrandLogoProps) {
  const isHeader = variant === 'header';

  return (
    <Link
      href="/"
      aria-label="TicketGo Teknoloji Ana Sayfa"
      className="inline-flex shrink-0 self-center flex-col items-start bg-transparent py-1 gap-0 no-underline"
    >
      {/* ticket + Go wordmark */}
      <span
        className={`font-extrabold leading-none tracking-tight ${isHeader ? 'text-[26px] sm:text-[30px]' : 'text-[22px]'}`}
        aria-hidden="true"
      >
        <span style={{ color: '#1e3a8a' }}>ticket</span>
        <span style={{ color: '#0ea5e9' }}>Go</span>
      </span>

      {/* Teknoloji A.Ş. */}
      <span
        className="font-medium leading-none"
        style={{
          color: '#1e3a8a',
          fontSize: isHeader ? '11px' : '9px',
          letterSpacing: '0.10em',
          marginTop: '3px',
          opacity: 0.75,
        }}
      >
        Teknoloji A.Ş.
      </span>
    </Link>
  );
}
