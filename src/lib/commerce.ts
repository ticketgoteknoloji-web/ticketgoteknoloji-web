import {
  calculateTotalMinor,
  calculateVatMinor,
  resolveVatRate,
  resolveVatRatePercent,
} from '@/config/vat';
import {
  billedAnnualTotal,
  discountFor,
  pricingCatalog,
  recurringPrice,
  type BillingPeriod,
  type PricedItem,
} from '@/lib/pricing';
import { toMinorUnits } from '@/lib/money';

export type PaymentPeriod = BillingPeriod | 'once';

const PERIOD_LABEL: Record<PaymentPeriod, string> = {
  monthly: 'Aylık dönem',
  annual: 'Yıllık peşin',
  once: 'Tek seferlik',
};

export function paymentPeriodLabel(period: PaymentPeriod): string {
  return PERIOD_LABEL[period];
}

const PURCHASABLE_IDS = new Set([
  'ticketgo-starter',
  'ticketgo-growth',
  'ticketgo-scale',
  'discovery',
  'ai-starter',
  'ai-growth',
  'ai-scale',
  'support-essential',
  'support-professional',
  'support-mission',
  'extra-operator-seat',
  'extra-support-hour',
  'extra-environment',
]);

type AddOn = (typeof pricingCatalog.addOns)[number];

function allPricedItems(): Array<PricedItem | AddOn> {
  return [
    ...pricingCatalog.plans,
    ...pricingCatalog.services,
    ...pricingCatalog.aiPlans,
    ...pricingCatalog.supportPlans,
    ...pricingCatalog.addOns,
  ];
}

export function findCatalogItem(productId: string): PricedItem | AddOn | null {
  return allPricedItems().find((item) => item.id === productId) ?? null;
}

export function isPurchasable(productId: string): boolean {
  return PURCHASABLE_IDS.has(productId);
}

export function purchasableCatalogItems(): Array<PricedItem | AddOn> {
  return allPricedItems().filter((item) => isPurchasable(item.id));
}

export function paymentUrl(productId: string, period: PaymentPeriod, quantity = 1): string {
  const params = new URLSearchParams({ productId, period });
  if (quantity !== 1) params.set('qty', String(quantity));
  return `/payment?${params.toString()}`;
}

export function checkoutPeriodFor(productId: string, billingPeriod: BillingPeriod): PaymentPeriod {
  const item = findCatalogItem(productId);
  if (!item) return billingPeriod;
  if ('monthlyPrice' in item) {
    // If a flat priceUsd is defined, use its billingType directly
    if (item.priceUsd != null && item.billingType) return item.billingType;
    if (item.model === 'project-fixed' || item.monthlyPrice === null) return 'once';
    return billingPeriod;
  }
  // Add-ons: use billingType if set, otherwise 'once'
  return (item as { billingType?: string }).billingType === 'annual' ? 'annual' : 'once';
}

export type QuoteLine = {
  label: string;
  amountMinor: number;
};

export type ProductQuote = {
  productId: string;
  productName: string;
  description: string;
  quantity: number;
  currency: string;
  period: PaymentPeriod;
  lines: QuoteLine[];
  unitMinor: number;
  subtotalMinor: number;
  vatMinor: number;
  totalMinor: number;
  vatRate: number;
  vatRatePercent: number;
  periodLabel: string;
};

export function quoteProduct(input: {
  productId: string;
  period: PaymentPeriod;
  quantity?: number;
}): ProductQuote | { error: string } {
  const item = findCatalogItem(input.productId);
  if (!item) return { error: 'Ürün bulunamadı.' };
  if (!isPurchasable(item.id)) {
    return { error: 'Bu kalem sabit fiyatlı satışa açık değildir. Teklif alın.' };
  }

  const quantity = Math.min(20, Math.max(1, Math.trunc(input.quantity ?? 1)));
  const period = input.period;
  let unit = 0;
  let setup = 0;
  let description = '';

  if ('monthlyPrice' in item) {
    description = item.headline;
    // Prefer the fixed USD price from catalog when available
    if (item.priceUsd != null) {
      const expectedPeriod = item.billingType ?? (item.model === 'project-fixed' ? 'once' : 'annual');
      if (period !== expectedPeriod) {
        return { error: expectedPeriod === 'once' ? 'Bu hizmet tek seferlik satılır.' : 'Bu paket yıllık faturalanır.' };
      }
      unit = item.priceUsd;
      setup = 0; // setup fee absorbed into flat priceUsd
    } else if (item.model === 'project-fixed') {
      if (period !== 'once') return { error: 'Bu hizmet tek seferlik satılır.' };
      unit = item.setupFee ?? 0;
    } else if (item.monthlyPrice !== null) {
      if (period !== 'monthly' && period !== 'annual') {
        return { error: 'Abonelik dönemi aylık veya yıllık olmalıdır.' };
      }
      const discount = discountFor(item.category);
      unit = period === 'annual' ? billedAnnualTotal(item.monthlyPrice, discount) : recurringPrice(item.monthlyPrice, period, discount);
      setup = item.setupFee ?? 0;
    } else {
      return { error: 'Bu kalemin tanımlı fiyatı yoktur.' };
    }
  } else {
    if (period !== 'once') return { error: 'Bu kalem tek seferlik satılır.' };
    description = item.description;
    // Prefer priceUsd for add-ons
    unit = (item as { priceUsd?: number }).priceUsd ?? item.price;
  }

  const lines: QuoteLine[] = [
    {
      label: period === 'annual' ? `${item.name} · yıllık peşin` : period === 'monthly' ? `${item.name} · ilk ay` : item.name,
      amountMinor: toMinorUnits(unit) * quantity,
    },
  ];
  if (setup > 0) {
    lines.push({ label: 'Kurulum / onboarding', amountMinor: toMinorUnits(setup) });
  }

  const subtotalMinor = lines.reduce((sum, line) => sum + line.amountMinor, 0);
  const rate = resolveVatRate();
  const vatMinor = calculateVatMinor(subtotalMinor, rate);
  return {
    productId: item.id,
    productName: item.name,
    description,
    quantity,
    currency: pricingCatalog.currency,
    period,
    lines,
    unitMinor: toMinorUnits(unit),
    subtotalMinor,
    vatMinor,
    totalMinor: calculateTotalMinor(subtotalMinor, rate),
    vatRate: rate,
    vatRatePercent: resolveVatRatePercent(rate),
    periodLabel: PERIOD_LABEL[period],
  };
}
