/** TCMB USD/TRY quote is refreshed at most once per hour, aligned to the clock hour. */
export const USD_TRY_REFRESH_MS = 60 * 60 * 1000;

/** Milliseconds until the next wall-clock hour (15:00, 16:00, …). */
export function msUntilNextClockHour(now = Date.now()): number {
  const remaining = USD_TRY_REFRESH_MS - (now % USD_TRY_REFRESH_MS);
  return remaining === 0 ? USD_TRY_REFRESH_MS : remaining;
}

export function isUsdTryQuoteStale(fetchedAtMs: number, now = Date.now()): boolean {
  if (!Number.isFinite(fetchedAtMs) || fetchedAtMs <= 0) return true;
  return now - fetchedAtMs >= USD_TRY_REFRESH_MS;
}
