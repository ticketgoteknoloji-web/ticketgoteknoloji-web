'use client';

import type { ReactNode } from 'react';
import { Info } from 'lucide-react';
import { convertUsdToTry } from '@/lib/fx/convert';
import { formatTcmbDate, formatTryAmount, formatTryRate, formatUsdAmount } from '@/lib/fx/format';
import { useUsdTryQuote } from '@/components/price/FxProvider';

const RATE_HINT = 'TL fiyatı TCMB tarafından yayımlanan USD satış kuru kullanılarak hesaplanmıştır.';

export type ProductPriceProps = {
  usdPrice: number;
  showTry?: boolean;
  showRateInfo?: boolean;
  compact?: boolean;
  periodLabel?: string;
  usdFractionDigits?: number;
  prefix?: ReactNode;
  className?: string;
};

export function ProductPrice({
  usdPrice,
  showTry = true,
  showRateInfo = true,
  compact = false,
  periodLabel,
  usdFractionDigits = 0,
  prefix,
  className = '',
}: ProductPriceProps) {
  const { quote, loading } = useUsdTryQuote();
  const usdLabel = formatUsdAmount(usdPrice, usdFractionDigits);
  const tryValue = quote.rate != null ? convertUsdToTry(usdPrice, quote.rate) : null;
  const tryLabel = tryValue != null ? `≈ ${formatTryAmount(tryValue)}` : null;
  const tooltip =
    quote.rate != null
      ? `${RATE_HINT} 1 USD = ${formatTryRate(quote.rate)}${quote.date ? ` · ${formatTcmbDate(quote.date)}` : ''}`
      : RATE_HINT;

  const usdLine = (
    <span className="text-ink">
      {prefix}
      {usdLabel}
      {periodLabel ? <span className="ml-1 text-sm font-medium text-muted">{periodLabel}</span> : null}
    </span>
  );

  const tryLine = showTry ? (
    <span className="mt-0.5 flex min-h-[1.25rem] items-center gap-1 text-sm font-medium text-muted">
      {loading && tryLabel == null ? (
        <span>TL karşılığı hesaplanıyor...</span>
      ) : tryLabel ? (
        <>
          <span>{tryLabel}</span>
          {showRateInfo ? (
            <span className="relative inline-flex" title={tooltip}>
              <Info className="shrink-0 text-muted" size={13} aria-label={tooltip} />
            </span>
          ) : null}
        </>
      ) : (
        <span>TL karşılığı şu anda hesaplanamıyor</span>
      )}
    </span>
  ) : null;

  if (compact) {
    return (
      <span className={`inline-flex min-h-[1.25rem] flex-wrap items-baseline gap-x-1.5 ${className}`}>
        {usdLine}
        {showTry ? (
          <span className="text-sm font-medium text-muted">
            {loading && tryLabel == null
              ? 'TL karşılığı hesaplanıyor...'
              : tryLabel
                ? `/ ${tryLabel}`
                : '/ TL karşılığı şu anda hesaplanamıyor'}
          </span>
        ) : null}
      </span>
    );
  }

  return (
    <span className={`block ${className}`}>
      <span className="block text-2xl font-semibold tracking-tight">{usdLine}</span>
      {tryLine}
    </span>
  );
}
