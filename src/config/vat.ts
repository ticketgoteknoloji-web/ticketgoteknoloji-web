/** Central VAT configuration — single source of truth for checkout and legal documents. */
export const VAT_RATE = 0.2;
export const VAT_RATE_PERCENT = 20;

/**
 * Optional override via PAYMENT_VAT_RATE (0.2 or 20). Defaults to 20% KDV.
 */
export function resolveVatRate(): number {
  const raw = process.env.PAYMENT_VAT_RATE?.trim();
  if (!raw) return VAT_RATE;
  const value = Number(raw.replace(',', '.'));
  if (!Number.isFinite(value) || value < 0) return VAT_RATE;
  if (value > 1 && value <= 100) return value / 100;
  if (value <= 1) return value;
  return VAT_RATE;
}

export function resolveVatRatePercent(rate = resolveVatRate()): number {
  return Math.round(rate * 100);
}

/** Kuruş (minor unit) based VAT — rounded half-up to nearest kuruş. */
export function calculateVatMinor(subtotalMinor: number, rate = resolveVatRate()): number {
  if (subtotalMinor <= 0 || rate <= 0) return 0;
  return Math.round(subtotalMinor * rate);
}

export function calculateTotalMinor(subtotalMinor: number, rate = resolveVatRate()): number {
  return subtotalMinor + calculateVatMinor(subtotalMinor, rate);
}

export function vatRateLabel(rate = resolveVatRate()): string {
  return `%${resolveVatRatePercent(rate)}`;
}
