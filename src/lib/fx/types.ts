export type UsdTryQuoteStatus = 'LIVE' | 'CACHED' | 'UNAVAILABLE';

export type UsdTryQuote = {
  base: 'USD';
  quote: 'TRY';
  rate: number | null;
  source: 'TCMB';
  rateType: 'ForexSelling';
  date: string | null;
  updatedAt: string | null;
  status: UsdTryQuoteStatus;
};
