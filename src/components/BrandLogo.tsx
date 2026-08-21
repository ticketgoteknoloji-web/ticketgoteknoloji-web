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
      className="inline-flex shrink-0 flex-col items-start gap-0 self-center bg-transparent py-1 no-underline"
    >
      <span
        className={`font-sans font-bold leading-none tracking-tight ${isHeader ? 'text-[1.625rem] sm:text-[1.875rem]' : 'text-[1.375rem]'}`}
        aria-hidden="true"
      >
        <span className="text-[#1e3a8a]">ticket</span>
        <span className="text-[#0ea5e9]">Go</span>
      </span>
      <span
        className={`mt-0.5 font-sans font-medium leading-none tracking-[0.1em] text-[#1e3a8a]/75 ${
          isHeader ? 'text-[0.6875rem]' : 'text-[0.5625rem]'
        }`}
      >
        Teknoloji A.Ş.
      </span>
    </Link>
  );
}
