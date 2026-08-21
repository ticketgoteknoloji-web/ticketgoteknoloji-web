'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Check, Minus, Puzzle } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { BuyButton } from '@/components/BuyButton';
import { OfferingGrid } from '@/components/pricing/OfferingGrid';
import { isPurchasable, paymentUrl } from '@/lib/commerce';
import { formatUsd } from '@/lib/money';
import {
  discountFor,
  priceLabel,
  pricingCatalog,
  quoteUrl,
  savingsPercent,
  type BillingPeriod,
} from '@/lib/pricing';

const ADDON_IMAGES: Record<string, string> = {
  'extra-operator-seat': '/images/pricing/pricing-addon-operator.webp',
  'extra-support-hour':  '/images/pricing/pricing-addon-support-hour.webp',
  'extra-environment':   '/images/pricing/pricing-addon-environment.webp',
  'custom-integration':  '/images/pricing/pricing-ticketgo-scale.webp',
  'mobile-app':          '/images/pricing/pricing-ticketgo-growth.webp',
  'data-migration':      '/images/pricing/pricing-addon-environment.webp',
};

function displayValue(value: string | boolean | number | undefined): string {
  if (value === true) return 'Var';
  if (value === false) return 'Yok';
  if (value === undefined) return '—';
  return String(value);
}

function BillingToggle({
  period,
  onChange,
}: {
  period: BillingPeriod;
  onChange: (value: BillingPeriod) => void;
}) {
  return (
    <div role="radiogroup" aria-label="Fatura dönemi" className="inline-flex rounded-full border border-line bg-canvas p-1">
      {(
        [
          { id: 'monthly', label: 'Aylık' },
          { id: 'annual', label: `Yıllık · %${savingsPercent(pricingCatalog.annualDiscount)} tasarruf` },
        ] as const
      ).map((option) => (
        <button
          key={option.id}
          type="button"
          role="radio"
          aria-checked={period === option.id}
          onClick={() => onChange(option.id)}
          className={`h-11 rounded-full px-4 text-sm font-semibold transition-colors duration-200 ${
            period === option.id
              ? 'bg-brand-600 text-white shadow-sm'
              : 'text-muted hover:bg-surface hover:text-brand-600'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function OfferingSection({
  id,
  eyebrow,
  title,
  subtitle,
  extra,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  extra?: ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="section-wrap section-y scroll-section" aria-labelledby={`${id}-title`}>
      <p className="eyebrow">{eyebrow}</p>
      <h2 id={`${id}-title`} className="mt-2 text-[2.25rem] font-semibold tracking-tight text-ink sm:text-[2.5rem]">
        {title}
      </h2>
      <p className="section-subtitle">{subtitle}</p>
      {extra}
      {children}
    </section>
  );
}

export function PricingView() {
  const [period, setPeriod] = useState<BillingPeriod>('annual');
  const [openFaq, setOpenFaq] = useState<string | null>(pricingCatalog.faq[0]?.question ?? null);
  const ticketOverage = useMemo(
    () => ({
      'ticketgo-starter': 0.15,
      'ticketgo-growth': 0.12,
      'ticketgo-scale': 0.08,
    }),
    []
  );

  return (
    <div>
      <section className="section-wrap section-y">
        <p className="eyebrow">Fiyatlandırma</p>
        <h1 className="section-title mt-3">Ürün, hizmet ve bakım fiyatları</h1>
        <p className="section-subtitle">
          Kurumsal yazılım platformları, özel yazılım, AI entegrasyonu ve bakım işleri ayrı fiyat modelleriyle sunulur.
          Sabit fiyatlı paketler ödeme sayfasına, özel kapsamlı işler teklif formuna gider.
        </p>
        <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <BillingToggle period={period} onChange={setPeriod} />
          <p className="text-sm text-muted">{pricingCatalog.taxNoticeTr}</p>
        </div>
        <p className="mt-3 text-xs text-muted">{pricingCatalog.taxNotice}</p>
      </section>

      <OfferingSection
        id="urun"
        eyebrow="Ürün"
        title="Dijital platform paketleri"
        subtitle="Aşağıdaki rakamlar self-servis abonelik değil; kurulumlu platform kullanımı için başlangıç fiyatlarıdır. Kapsam keşiften sonra netleşir."
      >
        <OfferingGrid items={pricingCatalog.plans} variant="product" period={period} />
      </OfferingSection>

      <section className="section-wrap pb-12 sm:pb-16" aria-labelledby="plan-compare">
        <h2 id="plan-compare" className="text-[1.375rem] font-semibold tracking-tight text-ink sm:text-2xl">
          Platform paket karşılaştırması
        </h2>
        <div className="mt-6 overflow-x-auto rounded-2xl border border-line bg-surface">
          <table className="min-w-[720px] w-full border-collapse text-left text-sm">
            <caption className="sr-only">Platform paket özellik karşılaştırması</caption>
            <thead>
              <tr className="border-b border-line bg-canvas">
                <th scope="col" className="px-4 py-3 font-semibold text-ink">
                  Özellik
                </th>
                {pricingCatalog.plans.map((plan) => (
                  <th key={plan.id} scope="col" className="px-4 py-3 font-semibold text-ink">
                    {plan.name}
                    {plan.popular ? <span className="sr-only"> (en popüler)</span> : null}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-line">
                <th scope="row" className="px-4 py-3 font-medium text-ink">
                  Fiyat ({period === 'annual' ? 'yıllık eşdeğer / ay' : 'aylık'})
                </th>
                {pricingCatalog.plans.map((plan) => (
                  <td key={plan.id} className="px-4 py-3 text-muted">
                    {priceLabel(plan, period)}
                  </td>
                ))}
              </tr>
              {pricingCatalog.comparisonRows.map((row) => (
                <tr key={row.id} className="border-b border-line last:border-0">
                  <th scope="row" className="px-4 py-3 font-medium text-ink">
                    {row.label}
                  </th>
                  {pricingCatalog.plans.map((plan) => {
                    const value = plan.comparison?.[row.id];
                    return (
                      <td key={plan.id} className="px-4 py-3 text-muted">
                        {typeof value === 'boolean' ? (
                          value ? (
                            <Check className="text-brand-500" size={16} aria-label="Var" />
                          ) : (
                            <Minus className="text-muted" size={16} aria-label="Yok" />
                          )
                        ) : (
                          displayValue(value)
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
              <tr>
                <th scope="row" className="px-4 py-3 font-medium text-ink">
                  Aşım (kayıt başı)
                </th>
                {pricingCatalog.plans.map((plan) => (
                  <td key={plan.id} className="px-4 py-3 text-muted">
                    {ticketOverage[plan.id as keyof typeof ticketOverage]
                      ? formatUsd(ticketOverage[plan.id as keyof typeof ticketOverage])
                      : 'Teklif'}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <OfferingSection
        id="hizmet"
        eyebrow="Hizmet"
        title="Yazılım hizmetleri"
        subtitle="Özel CRM, SaaS, web/mobil, API ve operasyon sistemleri proje bazlıdır. Belirsiz kapsam düşük sabit fiyata bağlanmaz."
      >
        <OfferingGrid items={pricingCatalog.services} variant="service" period={period} />
      </OfferingSection>

      <OfferingSection
        id="ai-entegrasyon"
        eyebrow="Hizmet"
        title="AI entegrasyonu"
        subtitle="Kurulum ücreti + aylık yönetim + işlem kotası. Kota bitince işlem durur veya aşım uygulanır. Model faturaları değişirse kota güncellenebilir."
        extra={
          period === 'annual' ? (
            <p className="mt-2 text-sm text-brand-700">
              AI yıllık ödemesinde indirim %{savingsPercent(discountFor('ai'))}’tir.
            </p>
          ) : null
        }
      >
        <OfferingGrid items={pricingCatalog.aiPlans} variant="service" period={period} />
      </OfferingSection>

      <OfferingSection
        id="bakim"
        eyebrow="Bakım"
        title="Bakım ve destek"
        subtitle="Yayınlanmış ürünler için aylık retainer. Kullanılmayan saatler bir sonraki aya devretmez. Yeni özellik işleri saat kotasını aşarsa ayrıca faturalanır."
      >
        <OfferingGrid items={pricingCatalog.supportPlans} variant="maintenance" period={period} />
      </OfferingSection>

      <section id="ekler" className="section-wrap section-y scroll-section" aria-labelledby="addons">
        <p className="eyebrow">Hizmet</p>
        <h2 id="addons" className="mt-2 text-[2.25rem] font-semibold tracking-tight text-ink sm:text-[2.5rem]">
          Add-on ve aşım ücretleri
        </h2>
        <div className="mt-8 grid auto-rows-fr gap-5 md:grid-cols-2 xl:grid-cols-3">
          {pricingCatalog.addOns.map((item) => {
            const addonImg = ADDON_IMAGES[item.id] ?? null;
            return (
            <article key={item.id} className="selectable-card group flex h-full min-w-0 flex-col rounded-2xl border border-line bg-surface p-5 shadow-soft sm:p-6">
              {addonImg && (
                <div className="relative -mx-5 -mt-5 mb-4 h-[110px] overflow-hidden rounded-t-2xl sm:-mx-6 sm:-mt-6">
                  <Image
                    src={addonImg}
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
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl border border-brand-200 bg-brand-50 text-brand-600">
                <Puzzle size={24} aria-hidden />
              </span>
              <h3 className="mt-4 min-h-[3.25rem] text-xl font-semibold leading-snug text-ink">{item.name}</h3>
              <p className="mt-3 min-h-[6rem] line-clamp-4 text-sm leading-6 text-muted">{item.description}</p>
              <div className="mt-5 min-h-[5.25rem]">
                <p className="text-2xl font-semibold tracking-tight text-ink">
                  {item.startingAt ? <span className="mr-1 text-sm font-medium text-muted">Başlangıç </span> : null}
                  {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(item.priceUsd ?? item.price)}
                  {item.periodLabel && (
                    <span className="ml-1 text-sm font-medium text-muted">{item.periodLabel}</span>
                  )}
                </p>
                <p className="mt-0.5 text-xs font-medium text-muted">KDV hariç</p>
                {(item.priceUsd ?? item.price) > 0 && (
                  <p className="mt-1 text-sm text-muted">
                    KDV dahil:{' '}
                    <span className="font-semibold text-ink">
                      {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Math.round((item.priceUsd ?? item.price) * 1.2))}
                    </span>
                    <span className="ml-1 text-xs text-muted">(%20 KDV)</span>
                  </p>
                )}
              </div>
              <div className="mt-auto pt-6">
                {isPurchasable(item.id) ? (
                  <BuyButton href={paymentUrl(item.id, 'once')} className="btn btn-secondary w-full rounded-full">
                    Satın Al
                  </BuyButton>
                ) : (
                  <Link
                    href={quoteUrl(item.contactType, item.ctaMessage)}
                    className="btn btn-secondary w-full rounded-full"
                  >
                    Teklif Al
                  </Link>
                )}
              </div>
              </article>
            );
          })}
        </div>
        <div className="mt-8 overflow-x-auto rounded-2xl border border-line bg-surface">
          <table className="min-w-[560px] w-full text-left text-sm">
            <caption className="sr-only">Kullanım aşım ücretleri</caption>
            <thead>
              <tr className="border-b border-line bg-canvas">
                <th scope="col" className="px-4 py-3 font-semibold">
                  Aşım
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  Birim fiyat
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  Not
                </th>
              </tr>
            </thead>
            <tbody>
              {pricingCatalog.overageRates.map((row) => (
                <tr key={row.id} className="border-b border-line last:border-0">
                  <th scope="row" className="px-4 py-3 font-medium text-ink">
                    {row.name}
                  </th>
                  <td className="px-4 py-3 text-muted">{formatUsd(row.price)}</td>
                  <td className="px-4 py-3 text-muted">{row.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="section-wrap section-y" aria-labelledby="scope-notes">
        <h2 id="scope-notes" className="text-[2.25rem] font-semibold tracking-tight text-ink sm:text-[2.5rem]">
          Kapsam, sorumluluk ve iptal
        </h2>
        <div className="mt-8 grid auto-rows-fr gap-5 md:grid-cols-2 xl:grid-cols-3">
          {[
            {
              title: 'Müşteri sorumlulukları',
              text: 'Marka, yasal metin, ödeme hesabı, iş kuralları ve zamanında kabul testi olmadan teslim kayar.',
            },
            {
              title: 'Hariç işler',
              text: 'Ödeme komisyonları, SMS operatör tarifesi, bulut aşımı, LLM model faturası ve belgesiz yeni özellikler paket dışıdır.',
            },
            {
              title: 'İptal',
              text: 'Abonelik dönem sonuna kadar sürer. Yıllık peşinde 14 gün cayma hakkı vardır. Tamamlanan proje fazları iade edilmez.',
            },
          ].map((card) => (
            <article key={card.title} className="flex h-full min-w-0 flex-col rounded-2xl border border-line bg-surface p-5 shadow-soft sm:p-6">
              <h3 className="min-h-[3.25rem] text-xl font-semibold leading-snug text-ink">{card.title}</h3>
              <p className="mt-3 text-sm leading-6 text-muted">{card.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section-wrap section-y" aria-labelledby="pricing-faq">
        <h2 id="pricing-faq" className="text-[2.25rem] font-semibold tracking-tight text-ink sm:text-[2.5rem]">
          Fiyatlandırma SSS
        </h2>
        <div className="mt-6 divide-y divide-line rounded-2xl border border-line bg-surface">
          {pricingCatalog.faq.map((item, index) => {
            const open = openFaq === item.question;
            const panelId = `pricing-faq-${index}`;
            return (
              <div key={item.question} className="px-5 py-2 sm:px-6">
                <h3>
                  <button
                    type="button"
                    aria-expanded={open}
                    aria-controls={panelId}
                    className="flex min-h-11 w-full items-center justify-between gap-4 py-3 text-left text-sm font-semibold text-ink"
                    onClick={() => setOpenFaq(open ? null : item.question)}
                  >
                    {item.question}
                    <span aria-hidden>{open ? '−' : '+'}</span>
                  </button>
                </h3>
                {open ? (
                  <p id={panelId} className="pb-4 text-sm leading-6 text-muted">
                    {item.answer}
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
