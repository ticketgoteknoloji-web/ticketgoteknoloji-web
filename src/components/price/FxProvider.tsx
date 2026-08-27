'use client';

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { UsdTryQuote } from '@/lib/fx/types';

type FxContextValue = {
  quote: UsdTryQuote;
  loading: boolean;
};

const EMPTY: UsdTryQuote = {
  base: 'USD',
  quote: 'TRY',
  rate: null,
  source: 'TCMB',
  rateType: 'ForexSelling',
  date: null,
  updatedAt: null,
  status: 'UNAVAILABLE',
};

const FxContext = createContext<FxContextValue>({ quote: EMPTY, loading: true });

export function FxProvider({
  initial,
  children,
}: {
  initial: UsdTryQuote | null;
  children: ReactNode;
}) {
  const [quote, setQuote] = useState<UsdTryQuote>(initial ?? EMPTY);
  const [loading, setLoading] = useState(!initial);

  useEffect(() => {
    if (initial?.rate != null) {
      setQuote(initial);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetch('/api/exchange-rates/usd-try', { headers: { Accept: 'application/json' } })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: UsdTryQuote | null) => {
        if (!cancelled && data && typeof data === 'object') {
          setQuote({
            base: 'USD',
            quote: 'TRY',
            rate: typeof data.rate === 'number' && data.rate > 0 ? data.rate : null,
            source: 'TCMB',
            rateType: 'ForexSelling',
            date: data.date ?? null,
            updatedAt: data.updatedAt ?? null,
            status: data.status === 'LIVE' || data.status === 'CACHED' ? data.status : 'UNAVAILABLE',
          });
        }
      })
      .catch(() => {
        if (!cancelled) setQuote(EMPTY);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [initial]);

  const value = useMemo(() => ({ quote, loading }), [quote, loading]);
  return <FxContext.Provider value={value}>{children}</FxContext.Provider>;
}

export function useUsdTryQuote(): FxContextValue {
  return useContext(FxContext);
}
