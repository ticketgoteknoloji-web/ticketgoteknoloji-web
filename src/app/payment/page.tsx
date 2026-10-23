import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { redirect } from 'next/navigation';
import { BrandLogo } from '@/components/BrandLogo';
import { BuyButton } from '@/components/BuyButton';
import { PaymentCheckout } from '@/components/payment/PaymentCheckout';
import { ProductPrice } from '@/components/price/ProductPrice';
import {
  checkoutPeriodFor,
  paymentUrl,
  type PaymentPeriod,
} from '@/lib/commerce';
import {
  findCatalogItem,
  isPurchasable,
  quoteProduct,
} from '@/lib/commerce-server';
import { getQnbCardPrograms, merchantInstallmentCounts } from '@/config/qnbpay-card-programs';
import { getPaymentConfig, isTamiReady, tamiConfig } from '@/lib/payments/config';
import { getOrderById } from '@/lib/payments/orders';
import { quoteUrl } from '@/lib/pricing';
import { getProductImage } from '@/lib/payments/product-images';
import { pricingCatalog } from '@/lib/pricing';
import { VAT_RATE, VAT_RATE_PERCENT } from '@/config/vat';
import type { PricedItem } from '@/lib/pricing';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const metadata: Metadata = {
  title: 'Güvenli Ödeme',
  robots: { index: false, follow: false },
};

type Search = {
  product?: string;
  productId?: string;
  orderId?: string;
  order?: string;
  period?: string;
  qty?: string;
};

type ProductGroup = {
  eyebrow: string;
  title: string;
  items: Array<PricedItem | (typeof pricingCatalog.addOns)[number]>;
  note?: string;
};

function buildGroups(): ProductGroup[] {
  const byId = (ids: string[]) =>
    ids
      .map((id) => [...pricingCatalog.plans, ...pricingCatalog.services, ...pricingCatalog.aiPlans, ...pricingCatalog.supportPlans, ...pricingCatalog.addOns].find((x) => x.id === id))
      .filter(Boolean) as ProductGroup['items'];

  return [
    {
      eyebrow: 'TicketGo Platform',
      title: 'TicketGo Platform',
      items: byId(['ticketgo-starter', 'ticketgo-growth', 'ticketgo-scale']),
    },
    {
      eyebrow: 'Dijital Ürün Keşfi',
      title: 'Dijital Ürün Keşfi',
      items: byId(['discovery']),
    },
    {
      eyebrow: 'AI Services',
      title: 'AI Entegrasyon Paketleri',
      items: byId(['ai-starter', 'ai-growth', 'ai-scale']),
      note: 'Dahil kullanım kotası paket kapsamına göre uygulanır. Kota üzeri kullanım ayrıca ücretlendirilebilir.',
    },
    {
      eyebrow: 'Bakım & Destek',
      title: 'Bakım ve Destek',
      items: byId(['support-essential', 'support-professional', 'support-mission']),
    },
    {
      eyebrow: 'Ek Hizmetler',
      title: 'Ek Hizmetler',
      items: byId(['extra-operator-seat', 'extra-support-hour', 'extra-environment']),
    },
  ];
}

function getItemPriceUsd(item: PricedItem | (typeof pricingCatalog.addOns)[number]): number | null {
  if ('priceUsd' in item && item.priceUsd != null) return item.priceUsd as number;
  return null;
}

function getItemPeriodLabel(item: PricedItem | (typeof pricingCatalog.addOns)[number]): string {
  if ('periodLabel' in item && item.periodLabel) return item.periodLabel as string;
  return '';
}

function getItemHeadline(item: PricedItem | (typeof pricingCatalog.addOns)[number]): string {
  if ('headline' in item) return item.headline;
  return item.description;
}

function ProductCard({ item, eyebrow, recommended }: { item: PricedItem | (typeof pricingCatalog.addOns)[number]; eyebrow: string; recommended?: boolean }) {
  const img = getProductImage(item.id);
  const priceUsd = getItemPriceUsd(item);
  const periodLabel = getItemPeriodLabel(item);
  const period = checkoutPeriodFor(item.id, 'annual');
  const href = paymentUrl(item.id, period);
  const vatAmount = priceUsd != null ? Math.round(priceUsd * VAT_RATE) : null;
  const totalWithVat = priceUsd != null && vatAmount != null ? priceUsd + vatAmount : null;
  const isDiscovery = item.id === 'discovery';

  return (
    <li className="site-card group flex min-w-0 flex-col overflow-hidden">
      <div className="relative h-[170px] w-full overflow-hidden">
        <Image
          src={img.src}
          alt={img.alt}
          fill
          sizes="(max-width:640px) 100vw, (max-width:1024px) 50vw, 33vw"
          className="object-cover object-center transition-transform duration-300 group-hover:scale-[1.03]"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
        <div className="absolute left-3 top-3 flex gap-1.5">
          <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white backdrop-blur-sm">
            {eyebrow}
          </span>
          {recommended && (
            <span className="rounded-full bg-brand-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">
              Önerilen
            </span>
          )}
          {isDiscovery && (
            <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">
              Tek Seferlik
            </span>
          )}
        </div>
      </div>
      <div className="flex min-w-0 flex-1 flex-col p-4">
        <span className="block font-semibold text-ink">{item.name}</span>
        <span className="mt-1 block flex-1 text-xs leading-5 text-muted line-clamp-2">
          {getItemHeadline(item)}
        </span>

        {priceUsd != null ? (
          <div className="mt-3 space-y-0.5">
            <ProductPrice usdPrice={priceUsd} periodLabel={periodLabel} />
            <p className="text-[11px] text-muted">KDV hariç</p>
            {totalWithVat != null && (
              <p className="text-[11px] text-muted">
                KDV dahil:{' '}
                <ProductPrice compact usdPrice={totalWithVat} showRateInfo={false} className="inline-flex font-medium text-ink" />
                <span className="ml-1 text-muted">(%{VAT_RATE_PERCENT} KDV)</span>
              </p>
            )}
          </div>
        ) : null}

        <div className="mt-4">
          <BuyButton href={href} className="btn btn-primary w-full rounded-full">
            Satın Al
          </BuyButton>
        </div>
      </div>
    </li>
  );
}

const RECOMMENDED_IDS = new Set(['ticketgo-growth', 'support-professional']);

function PaymentEntry({ message }: { message?: string }) {
  const groups = buildGroups();
  return (
    <main className="section-wrap min-w-0 overflow-x-hidden py-10 sm:py-12">
      <BrandLogo variant="header" />
      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-sm">
        <Link href="/" className="font-medium text-brand-600">
          Ana Sayfaya Dön
        </Link>
      </div>
      <h1 className="mt-8 text-2xl font-semibold tracking-tight text-ink">Güvenli Ödeme</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
        Kart bilgilerinizi girerek Tami / Garanti BBVA Sanal POS güvenli ödeme altyapısı üzerinden işleminizi tamamlayabilirsiniz.
      </p>
      {message && (
        <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
          {message}
        </p>
      )}

      <div className="mt-10 space-y-12">
        {groups.map((group) => (
          <section key={group.eyebrow} aria-labelledby={`group-${group.eyebrow}`}>
            <div className="mb-1 flex items-center gap-3">
              <p className="eyebrow">
                {group.eyebrow}
              </p>
              <div className="h-px flex-1 bg-line" />
            </div>
            <h2 id={`group-${group.eyebrow}`} className="mt-1 text-lg font-semibold text-ink">
              {group.title}
            </h2>
            {group.note && (
              <p className="mt-1 text-xs leading-5 text-muted">{group.note}</p>
            )}
            <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {group.items.map((item) => (
                <ProductCard
                  key={item.id}
                  item={item}
                  eyebrow={group.eyebrow}
                  recommended={RECOMMENDED_IDS.has(item.id)}
                />
              ))}
            </ul>
          </section>
        ))}
      </div>

      <p className="mt-8 text-xs text-muted">
        Tüm fiyatlar USD cinsindendir ve KDV hariçtir. Ödeme adımında %{VAT_RATE_PERCENT} KDV eklenir. TL karşılığı TCMB güncel USD satış kuru üzerinden hesaplanır.
      </p>
      <Link href="/pricing" className="btn btn-secondary mt-4 rounded-full">
        Tüm fiyatları görün
      </Link>
    </main>
  );
}

export default async function PaymentPage({ searchParams }: { searchParams: Promise<Search> }) {
  const params = await searchParams;
  const existingOrderId = params.orderId?.trim() || params.order?.trim() || '';
  const existingOrder = existingOrderId ? await getOrderById(existingOrderId) : null;
  if (existingOrder?.status === 'paid') {
    redirect(`/payment/success?order=${encodeURIComponent(existingOrder.id)}`);
  }
  const productId = existingOrder?.productId || params.productId?.trim() || params.product?.trim() || '';
  const item = findCatalogItem(productId);
  const requested = (params.period ?? '') as PaymentPeriod;
  const period =
    existingOrder?.period ||
    (requested === 'monthly' || requested === 'annual' || requested === 'once'
      ? requested
      : checkoutPeriodFor(productId, 'annual'));
  const quote = productId
    ? quoteProduct({
        productId,
        period,
        quantity: existingOrder?.quantity ?? Number(params.qty ?? '1'),
      })
    : { error: 'Ürün seçilmedi.' as const };

  if (!productId) {
    return <PaymentEntry />;
  }

  if ('error' in quote) {
    if (item && !isPurchasable(item.id)) {
      const contact = 'contactType' in item ? quoteUrl(item.contactType, item.ctaMessage) : '/contact';
      return (
        <main className="section-wrap section-y">
          <BrandLogo variant="header" />
          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-sm">
            <Link href="/" className="font-medium text-brand-600">
              Ana Sayfaya Dön
            </Link>
          </div>
          <h1 className="mt-8 section-title">Güvenli Ödeme</h1>
          <p className="section-subtitle">{quote.error}</p>
          <Link href={contact} className="btn btn-primary mt-6 rounded-full">
            Teklif Al
          </Link>
        </main>
      );
    }
    return <PaymentEntry message={quote.error} />;
  }

  return (
    <main>
      <PaymentCheckout
        quote={quote}
        configured={isTamiReady()}
        testMode={getPaymentConfig().tami.env !== 'production'}
        providerStatus={`Tami: ${!tamiConfig().posId ? 'MISSING_POS_ID' : isTamiReady() ? 'READY' : 'CREDENTIAL BEKLİYOR'}`}
        cardPrograms={getQnbCardPrograms().filter((program) => program.enabled)}
        installments={merchantInstallmentCounts()}
      />
    </main>
  );
}
