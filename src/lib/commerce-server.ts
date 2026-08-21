import 'server-only';

import {
  calculateTotalMinor,
  calculateVatMinor,
  resolveVatRate,
  resolveVatRatePercent,
} from '@/config/vat';
import {
  findCatalogItem as findPricingCatalogItem,
  isPurchasable as isPricingPurchasable,
  paymentPeriodLabel,
  quoteProduct as quotePricingProduct,
  type PaymentPeriod,
  type ProductQuote,
} from '@/lib/commerce';
import { getDownloadPackageSync } from '@/lib/downloads/store';
import { toMinorUnits } from '@/lib/money';
import { pricingCatalog, type PricedItem } from '@/lib/pricing';

export type { PaymentPeriod, ProductQuote };

function downloadAsPricedItem(productId: string): PricedItem | null {
  const pkg = getDownloadPackageSync(productId);
  if (!pkg || pkg.priceUsd == null || pkg.priceUsd <= 0) return null;
  return {
    id: pkg.productId,
    name: pkg.name,
    category: 'download',
    model: 'project-fixed',
    headline: pkg.description,
    description: pkg.description,
    monthlyPrice: null,
    priceUsd: pkg.priceUsd,
    periodLabel: 'tek seferlik',
    billingType: 'once',
    startingAt: false,
    customQuote: false,
    popular: false,
    ctaLabel: 'Satın Al',
    contactType: 'download',
    ctaMessage: pkg.name,
    features: [],
    unit: 'lisans',
    setupFee: null,
    delivery: 'Dijital indirme',
    includes: [],
    excludes: [],
    customerResponsibilities: [],
    revisionLimits: '',
    cancellation: '',
  };
}

export function findCatalogItem(productId: string) {
  return findPricingCatalogItem(productId) ?? downloadAsPricedItem(productId);
}

export function isPurchasable(productId: string): boolean {
  if (isPricingPurchasable(productId)) return true;
  return downloadAsPricedItem(productId) != null;
}

export function quoteProduct(input: {
  productId: string;
  period: PaymentPeriod;
  quantity?: number;
}): ProductQuote | { error: string } {
  const download = downloadAsPricedItem(input.productId);
  if (!download || download.priceUsd == null) {
    return quotePricingProduct(input);
  }
  if (input.period !== 'once') {
    return { error: 'Bu yazılım paketi tek seferlik satılır.' };
  }
  const quantity = Math.min(20, Math.max(1, Math.trunc(input.quantity ?? 1)));
  const unit = download.priceUsd;
  const subtotalMinor = toMinorUnits(unit) * quantity;
  const rate = resolveVatRate();
  const vatMinor = calculateVatMinor(subtotalMinor, rate);
  return {
    productId: download.id,
    productName: download.name,
    description: download.headline,
    quantity,
    currency: pricingCatalog.currency,
    period: 'once',
    lines: [{ label: download.name, amountMinor: subtotalMinor }],
    unitMinor: toMinorUnits(unit),
    subtotalMinor,
    vatMinor,
    totalMinor: calculateTotalMinor(subtotalMinor, rate),
    vatRate: rate,
    vatRatePercent: resolveVatRatePercent(rate),
    periodLabel: paymentPeriodLabel('once'),
  };
}
