'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Check } from 'lucide-react';
import { BuyButton } from '@/components/BuyButton';
import { ProductPrice } from '@/components/price/ProductPrice';
import { checkoutPeriodFor, isPurchasable, paymentUrl } from '@/lib/commerce';
import { formatMoney } from '@/lib/money';
import {
  annualSavingsAmount,
  billedAnnualTotal,
  discountFor,
  priceExVatHint,
  pricingCatalog,
  recurringPrice,
  savingsPercent,
  type BillingPeriod,
  type PricedItem,
} from '@/lib/pricing';
import {
  offeringActionLabel,
  offeringIcon,
  type OfferingVariant,
} from '@/lib/offering-detail';

const CARD_IMAGES: Record<string, string> = {
  'ticketgo-starter':    '/images/pricing/pricing-ticketgo-starter.webp',
  'ticketgo-growth':     '/images/pricing/pricing-ticketgo-growth.webp',
  'ticketgo-scale':      '/images/pricing/pricing-ticketgo-scale.webp',
  'ticketgo-enterprise': '/images/pricing/pricing-ticketgo-scale.webp',
  'discovery':           '/images/pricing/pricing-discovery.webp',
  'mvp':                 '/images/pricing/pricing-ticketgo-starter.webp',
  'growth-product':      '/images/pricing/pricing-ticketgo-growth.webp',
  'dedicated-team':      '/images/pricing/pricing-support-professional.webp',
  'ai-starter':          '/images/pricing/pricing-ai-starter.webp',
  'ai-growth':           '/images/pricing/pricing-ai-growth.webp',
  'ai-scale':            '/images/pricing/pricing-ai-scale.webp',
  'support-essential':   '/images/pricing/pricing-support-essential.webp',
  'support-professional':'/images/pricing/pricing-support-professional.webp',
  'support-mission':     '/images/pricing/pricing-support-mission.webp',
  'extra-operator-seat': '/images/pricing/pricing-addon-operator.webp',
  'extra-support-hour':  '/images/pricing/pricing-addon-support-hour.webp',
  'extra-environment':   '/images/pricing/pricing-addon-environment.webp',
  'custom-integration':  '/images/pricing/pricing-ticketgo-scale.webp',
  'mobile-app':          '/images/pricing/pricing-ticketgo-growth.webp',
  'data-migration':      '/images/pricing/pricing-addon-environment.webp',
};

type OfferingCardProps = {
  item: PricedItem;
  variant: OfferingVariant;
  period: BillingPeriod;
  active?: boolean;
  hovered?: boolean;
  open?: boolean;
  onSelect: (id: string) => void;
  onHover: (id: string) => void;
  onLeave: (id: string) => void;
};

export function OfferingCard({
  item,
  variant,
  period,
  active,
  hovered,
  open,
  onSelect,
  onHover,
  onLeave,
}: OfferingCardProps) {
  const buy = isPurchasable(item.id);
  const href = buy ? paymentUrl(item.id, checkoutPeriodFor(item.id, period)) : quoteUrlSafe(item);
  const Action = buy ? BuyButton : Link;
  const label = offeringActionLabel(variant, buy, item);
  const Icon = offeringIcon(variant, item.category);
  const discount = discountFor(item.category);
  const cardImage = CARD_IMAGES[item.id] ?? null;
  // Use fixed priceUsd when available (new catalog), else fall back to monthlyPrice calculation
  const hasFlatPrice = item.priceUsd != null;
  const hasRecurring = !hasFlatPrice && item.monthlyPrice !== null && !item.customQuote;
  const amount = hasRecurring ? recurringPrice(item.monthlyPrice ?? 0, period, discount) : null;
  const yearly = hasRecurring ? billedAnnualTotal(item.monthlyPrice ?? 0, discount) : null;
  const saved = hasRecurring ? annualSavingsAmount(item.monthlyPrice ?? 0, discount) : null;
  const flatPrice = hasFlatPrice ? (item.priceUsd as number) : null;
  const flatPeriodLabel = hasFlatPrice ? (item.periodLabel as string | undefined) ?? '' : '';
  const vatAmount = flatPrice != null ? Math.round(flatPrice * 0.2) : null;
  const flatTotal = flatPrice != null && vatAmount != null ? flatPrice + vatAmount : null;
  const previewFeatures = item.features.slice(0, 4);

  return (
    <article
      data-active={active}
      data-hovered={hovered}
      onMouseEnter={() => onHover(item.id)}
      onMouseLeave={() => onLeave(item.id)}
      className={`selectable-card group flex h-full min-w-0 flex-col rounded-2xl border bg-surface p-5 shadow-soft sm:p-6 ${
        item.popular ? 'border-brand-600' : 'border-line'
      }`}
    >
      {cardImage && (
        <div className="relative -mx-5 -mt-5 mb-4 h-[110px] overflow-hidden rounded-t-2xl sm:-mx-6 sm:-mt-6">
          <Image
            src={cardImage}
            alt=""
            fill
            sizes="(max-width:768px) 100vw, 400px"
            className="object-cover object-center transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
            aria-hidden="true"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
        </div>
      )}

      {item.popular ? (
        <p className="mb-3 self-start rounded-full bg-brand-600 px-3 py-1 text-[11px] font-semibold text-white">
          En popüler
        </p>
      ) : (
        <span className="mb-3 h-7" aria-hidden />
      )}

      <button
        type="button"
        aria-pressed={active}
        aria-expanded={Boolean(open && active)}
        aria-haspopup="dialog"
        aria-label={`${item.name}. Detayları gör`}
        onClick={() => onSelect(item.id)}
        className="flex min-h-0 flex-1 flex-col text-left focus-visible:outline-none"
      >
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl border border-brand-200 bg-brand-50 text-brand-600">
          <Icon size={24} aria-hidden />
        </span>
        <h3 className="selectable-card-title mt-4 min-h-[3.25rem] text-xl font-semibold leading-snug text-ink">
          {item.name}
        </h3>
        <p className="mt-1 min-h-6 line-clamp-1 text-sm font-medium text-brand-700">{item.headline}</p>
        <p className="mt-3 min-h-[6rem] line-clamp-4 text-sm leading-6 text-muted">{item.description}</p>

        <div className="mt-5 min-h-[7.5rem]">
          {hasFlatPrice && flatPrice != null ? (
            <>
              <ProductPrice usdPrice={flatPrice} periodLabel={flatPeriodLabel} />
              <p className="mt-0.5 text-xs font-medium text-muted">{priceExVatHint()}</p>
              {flatTotal != null && (
                <p className="mt-1 text-sm text-muted">
                  KDV dahil:{' '}
                  <ProductPrice compact usdPrice={flatTotal} showRateInfo={false} className="inline-flex font-semibold text-ink" />
                  <span className="ml-1 text-xs text-muted">(%20 KDV)</span>
                </p>
              )}
            </>
          ) : item.customQuote || (amount === null && !item.setupFee) ? (
            <p className="text-2xl font-semibold tracking-tight text-ink">Özel teklif</p>
          ) : amount !== null ? (
            <>
              <ProductPrice
                usdPrice={amount}
                usdFractionDigits={2}
                prefix={item.startingAt ? <span className="mr-1 text-sm font-medium text-muted">Başlangıç </span> : null}
                periodLabel={item.unit.includes('ay') ? '/ ay' : undefined}
              />
              <p className="mt-0.5 text-xs font-medium text-muted">{priceExVatHint()}</p>
              {period === 'annual' && saved !== null && yearly !== null ? (
                <p className="mt-1 text-sm text-brand-700">
                  Yıllık {formatMoney(yearly, pricingCatalog.currency)} · {formatMoney(saved, pricingCatalog.currency)} tasarruf ({savingsPercent(discount)}%)
                </p>
              ) : (
                <p className="mt-1 line-clamp-1 text-sm text-muted">{item.unit}</p>
              )}
            </>
          ) : (
            <>
              <ProductPrice
                usdPrice={item.setupFee ?? 0}
                usdFractionDigits={2}
                prefix={item.startingAt ? <span className="mr-1 text-sm font-medium text-muted">Başlangıç </span> : null}
              />
              <p className="mt-0.5 text-xs font-medium text-muted">{priceExVatHint()}</p>
              <p className="mt-1 line-clamp-1 text-sm text-muted">{item.unit}</p>
            </>
          )}
          {!hasFlatPrice && item.setupFee && amount !== null ? (
            <p className="mt-1 text-sm text-muted">Kurulum: {formatMoney(item.setupFee, pricingCatalog.currency)} · {priceExVatHint()}</p>
          ) : null}
        </div>

        <ul className="mt-5 min-h-[7.5rem] space-y-2 text-sm text-ink">
          {previewFeatures.map((feature) => (
            <li key={feature} className="flex gap-2">
              <Check className="mt-0.5 shrink-0 text-brand-500" size={16} aria-hidden />
              <span className="line-clamp-1">{feature}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 min-h-10 line-clamp-2 text-xs leading-5 text-muted">
          {variant === 'maintenance' ? `Periyot: ${item.unit}` : `Teslim: ${item.delivery}`}
        </p>
        <span className="mt-4 text-xs font-semibold text-brand-600 opacity-100 transition-opacity duration-200 md:opacity-0 md:group-hover:opacity-100 md:group-data-[hovered=true]:opacity-100">
          Detayları Gör →
        </span>
      </button>

      <div className="mt-auto pt-6">
        <Action
          href={href}
          className={`btn w-full rounded-full ${item.popular ? 'btn-primary' : 'btn-secondary'}`}
        >
          {label}
        </Action>
      </div>
    </article>
  );
}

function quoteUrlSafe(item: PricedItem): string {
  const params = new URLSearchParams({ need: item.contactType, message: item.ctaMessage });
  return `/contact?${params.toString()}`;
}

export const offeringGridClassName = 'mt-8 grid auto-rows-fr gap-5 md:grid-cols-2 xl:grid-cols-3';
