import catalog from '@/data/pricing-catalog.json';
import { formatMoney, roundUsd } from '@/lib/money';

export type BillingPeriod = 'monthly' | 'annual';

export type PricedItem = {
  id: string;
  name: string;
  category: string;
  model: string;
  headline: string;
  description: string;
  monthlyPrice: number | null;
  /** Fixed USD price for self-serve checkout (annual or once, depending on billingType) */
  priceUsd?: number | null;
  /** Human-readable period suffix shown on cards (e.g. "/ yıl", "tek seferlik") */
  periodLabel?: string;
  /** Whether priceUsd is charged annually or once */
  billingType?: 'annual' | 'once';
  startingAt: boolean;
  customQuote: boolean;
  popular: boolean;
  ctaLabel: string;
  contactType: string;
  ctaMessage: string;
  features: string[];
  unit: string;
  setupFee: number | null;
  delivery: string;
  includes: string[];
  excludes: string[];
  customerResponsibilities: string[];
  revisionLimits: string;
  cancellation: string;
  recommended?: number | null;
  minimum?: number | null;
  premium?: number | null;
  comparison?: Record<string, string | boolean | number>;
};

export type PricingCatalog = {
  currency: string;
  billingPeriods: BillingPeriod[];
  annualDiscount: number;
  annualDiscountByCategory: Record<string, number>;
  taxNotice: string;
  taxNoticeTr: string;
  lastReviewedAt: string;
  plans: PricedItem[];
  services: PricedItem[];
  addOns: Array<{
    id: string;
    name: string;
    description: string;
    price: number;
    priceUsd?: number;
    periodLabel?: string;
    billingType?: 'annual' | 'once';
    unit: string;
    startingAt: boolean;
    contactType: string;
    ctaMessage: string;
  }>;
  usageLimits: Array<{
    id: string;
    name: string;
    unit: string;
    includedByPlan: Record<string, number | string>;
  }>;
  overageRates: Array<{
    id: string;
    name: string;
    price: number;
    unit: string;
    notes: string;
  }>;
  setupFees: Array<{
    id: string;
    name: string;
    price: number | null;
    customQuote: boolean;
    notes: string;
  }>;
  aiPlans: PricedItem[];
  supportPlans: PricedItem[];
  assumptions: string[];
  faq: Array<{ question: string; answer: string }>;
  comparisonRows: Array<{ id: string; label: string }>;
};

export const pricingCatalog = catalog as unknown as PricingCatalog;

export function discountFor(category: string): number {
  return pricingCatalog.annualDiscountByCategory[category] ?? pricingCatalog.annualDiscount;
}

export function recurringPrice(monthlyPrice: number, period: BillingPeriod, discount: number): number {
  if (period === 'monthly') return roundUsd(monthlyPrice);
  return roundUsd(monthlyPrice * (1 - discount));
}

export function billedAnnualTotal(monthlyPrice: number, discount: number): number {
  return roundUsd(recurringPrice(monthlyPrice, 'annual', discount) * 12);
}

export function annualSavingsAmount(monthlyPrice: number, discount: number): number {
  return roundUsd(monthlyPrice * 12 - billedAnnualTotal(monthlyPrice, discount));
}

export function savingsPercent(discount: number): number {
  return roundUsd(discount * 100);
}

export function quoteUrl(contactType: string, message: string): string {
  const params = new URLSearchParams({ need: contactType, message });
  return `/contact?${params.toString()}`;
}

export function priceLabel(item: PricedItem, period: BillingPeriod): string {
  if (item.customQuote || item.monthlyPrice === null) return 'Özel teklif';
  const discount = discountFor(item.category);
  const amount = recurringPrice(item.monthlyPrice, period, discount);
  const prefix = item.startingAt ? 'Başlangıç ' : '';
  return `${prefix}${formatMoney(amount, pricingCatalog.currency)}`;
}

export function priceExVatHint(): string {
  return 'KDV hariç';
}
