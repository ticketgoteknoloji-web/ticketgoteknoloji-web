'use client';

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { isUsdTryQuoteStale, msUntilNextClockHour } from '@/lib/fx/refresh';
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

function parseQuote(data: Partial<UsdTryQuote> | null | undefined): UsdTryQuote | null {
  if (!data || typeof data !== 'object') return null;
  return {
    base: 'USD',
    quote: 'TRY',
    rate: typeof data.rate === 'number' && data.rate > 0 ? data.rate : null,
    source: 'TCMB',
    rateType: 'ForexSelling',
    date: data.date ?? null,
    updatedAt: data.updatedAt ?? null,
    status: data.status === 'LIVE' || data.status === 'CACHED' ? data.status : 'UNAVAILABLE',
  };
}

async function fetchUsdTryQuote(): Promise<UsdTryQuote | null> {
  const response = await fetch('/api/exchange-rates/usd-try', {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });
  if (!response.ok) return null;
  return parseQuote((await response.json()) as Partial<UsdTryQuote>);
}

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
    let cancelled = false;
    let hourTimer: ReturnType<typeof setTimeout> | undefined;
    let lastFetchedAt = initial?.updatedAt ? Date.parse(initial.updatedAt) : 0;
    if (!Number.isFinite(lastFetchedAt)) lastFetchedAt = 0;

    const apply = (next: UsdTryQuote) => {
      if (cancelled) return;
      setQuote(next);
      lastFetchedAt = Date.now();
    };

    const load = async (showLoading: boolean) => {
      if (showLoading) setLoading(true);
      try {
        const next = await fetchUsdTryQuote();
        if (next) apply(next);
      } catch {
        if (!cancelled) {
          setQuote((current) => (current.rate != null ? current : EMPTY));
        }
      } finally {
        if (!cancelled && showLoading) setLoading(false);
      }
    };

    const scheduleHourlyRefresh = () => {
      if (hourTimer) clearTimeout(hourTimer);
      hourTimer = setTimeout(() => {
        void load(false).finally(() => {
          if (!cancelled) scheduleHourlyRefresh();
        });
      }, msUntilNextClockHour());
    };

    if (initial) {
      setQuote(initial);
      setLoading(false);
    }

    void load(initial?.rate == null);
    scheduleHourlyRefresh();

    const onVisible = () => {
      if (document.visibilityState !== 'visible' || cancelled) return;
      if (isUsdTryQuoteStale(lastFetchedAt)) {
        void load(false);
      }
      scheduleHourlyRefresh();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      if (hourTimer) clearTimeout(hourTimer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [initial]);

  const value = useMemo(() => ({ quote, loading }), [quote, loading]);
  return <FxContext.Provider value={value}>{children}</FxContext.Provider>;
}

export function useUsdTryQuote(): FxContextValue {
  return useContext(FxContext);
}
