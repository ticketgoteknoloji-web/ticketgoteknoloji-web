import { convertUsdMinorToTryMinor } from '@/lib/fx/convert';
import { getUsdTryQuote } from '@/services/exchange-rate';
import type { OrderRecord } from '@/lib/payments/types';

export type PaymentFxSnapshot = {
  originalAmountMinor: number;
  originalCurrency: 'USD';
  exchangeRate: number;
  exchangeRateSource: 'TCMB';
  exchangeRateDate: string;
  chargedAmountMinor: number;
  chargedCurrency: 'TRY';
};

export function hasFrozenTryCharge(order: OrderRecord | null | undefined): boolean {
  return Boolean(
    order &&
      (order.status === 'awaiting_payment' || order.status === 'processing') &&
      typeof order.exchangeRate === 'number' &&
      order.exchangeRate > 0 &&
      typeof order.chargedAmountMinor === 'number' &&
      order.chargedAmountMinor > 0 &&
      order.chargedCurrency === 'TRY'
  );
}

export async function snapshotTryCharge(usdTotalMinor: number, existing?: OrderRecord | null): Promise<PaymentFxSnapshot> {
  if (existing && hasFrozenTryCharge(existing)) {
    return {
      originalAmountMinor: existing.originalAmountMinor ?? usdTotalMinor,
      originalCurrency: 'USD',
      exchangeRate: existing.exchangeRate as number,
      exchangeRateSource: 'TCMB',
      exchangeRateDate: existing.exchangeRateDate || '',
      chargedAmountMinor: existing.chargedAmountMinor as number,
      chargedCurrency: 'TRY',
    };
  }

  const fx = await getUsdTryQuote();
  if (fx.rate == null) {
    throw new Error('TCMB döviz kuru alınamadı. Lütfen kısa süre sonra tekrar deneyin.');
  }

  return {
    originalAmountMinor: usdTotalMinor,
    originalCurrency: 'USD',
    exchangeRate: fx.rate,
    exchangeRateSource: 'TCMB',
    exchangeRateDate: fx.date || new Date().toISOString().slice(0, 10),
    chargedAmountMinor: convertUsdMinorToTryMinor(usdTotalMinor, fx.rate),
    chargedCurrency: 'TRY',
  };
}

export function tamiChargeMinor(order: OrderRecord): number {
  if (order.chargedCurrency === 'TRY' && typeof order.chargedAmountMinor === 'number' && order.chargedAmountMinor > 0) {
    return order.chargedAmountMinor;
  }
  throw new Error('missing_try_snapshot');
}
