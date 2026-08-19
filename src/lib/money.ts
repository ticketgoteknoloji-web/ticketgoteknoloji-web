export const PRICING_CURRENCY = 'USD' as const;

export function roundMoney(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

/** @deprecated Use roundMoney */
export const roundUsd = roundMoney;

export function toMinorUnits(amount: number): number {
  return Math.round(roundUsd(amount) * 100);
}

export function fromMinorUnits(minor: number): number {
  return minor / 100;
}

export function formatUsd(amount: number): string {
  return formatMoney(amount, PRICING_CURRENCY);
}

export function formatTry(amount: number): string {
  return formatMoney(amount, 'TRY');
}

export function formatTryMinor(minor: number): string {
  return formatMinor(minor, 'TRY');
}

export function formatMoney(amount: number, currency: string): string {
  const value = fromMinorUnits(toMinorUnits(amount));
  // Use en-US locale for clean $1,234.00 format; site content is Turkish but pricing in USD
  const locale = currency === 'USD' ? 'en-US' : 'tr-TR';
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatMinor(minor: number, currency: string): string {
  return formatMoney(fromMinorUnits(minor), currency);
}

export function addMinor(left: number, right: number): number {
  return left + right;
}
