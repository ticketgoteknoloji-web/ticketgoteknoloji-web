import { fromMinorUnits, toMinorUnits } from '@/lib/money';

/** TCMB publishes USD rates with 4 decimal places. */
export const TCMB_RATE_SCALE = 10000;

/**
 * Convert a USD major-unit amount to TRY major units (2 decimal places).
 * TL = USD × TCMB USD ForexSelling, rounded half-up to the nearest kuruş.
 */
export function convertUsdToTry(usdAmount: number, usdTryRate: number): number {
  return fromMinorUnits(convertUsdMinorToTryMinor(toMinorUnits(usdAmount), usdTryRate));
}

/**
 * Integer conversion: usdMinor (cents) × rate → tryMinor (kuruş).
 * Uses BigInt so 199 × 42.4639 does not drift in floating point.
 */
export function convertUsdMinorToTryMinor(usdMinor: number, usdTryRate: number): number {
  if (!Number.isFinite(usdMinor) || usdMinor < 0) {
    throw new Error('invalid_usd_amount');
  }
  if (!Number.isFinite(usdTryRate) || usdTryRate <= 0) {
    throw new Error('invalid_usd_try_rate');
  }
  const rateScaled = BigInt(Math.round(usdTryRate * TCMB_RATE_SCALE));
  if (rateScaled <= BigInt(0)) throw new Error('invalid_usd_try_rate');
  const usd = BigInt(Math.round(usdMinor));
  const product = usd * rateScaled;
  const half = BigInt(TCMB_RATE_SCALE / 2);
  return Number((product + half) / BigInt(TCMB_RATE_SCALE));
}
