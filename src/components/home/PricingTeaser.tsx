import Link from 'next/link';
import { BuyButton } from '@/components/BuyButton';
import { isPurchasable, paymentUrl } from '@/lib/commerce';
import { formatUsd } from '@/lib/money';
import { pricingCatalog } from '@/lib/pricing';

export function PricingTeaser() {
  const featured = pricingCatalog.plans.filter((item) => !item.customQuote);

  return (
    <section id="fiyatlandirma" className="section-wrap section-y scroll-section">
      <h2 className="section-title">Şeffaf başlangıç fiyatları</h2>
      <p className="section-subtitle">
        Platform paketleri tanımlı tutarla satın alınabilir. Özel yazılım, CRM ve kapsamı netleşmemiş işler teklif formuna
        gider.
      </p>
      <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {featured.map((item) => (
          <article
            key={item.id}
            className={`site-card p-6 ${item.popular ? 'border-brand-500' : ''}`}
          >
            {item.popular ? <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-600">En popüler</p> : null}
            <h3 className="mt-2 text-lg font-semibold text-ink">{item.name}</h3>
            <p className="mt-3 text-2xl font-semibold text-ink">
              Başlangıç {formatUsd(item.monthlyPrice ?? 0)}
              <span className="ml-1 text-sm font-medium text-muted">/ ay</span>
            </p>
            <p className="mt-2 text-sm leading-6 text-muted">{item.headline}</p>
            {isPurchasable(item.id) ? (
              <BuyButton href={paymentUrl(item.id, 'annual')} className="btn btn-primary mt-5">
                Satın Al
              </BuyButton>
            ) : null}
          </article>
        ))}
      </div>
      <p className="mt-6 text-sm text-muted">{pricingCatalog.taxNoticeTr}</p>
      <Link href="/pricing" className="btn btn-secondary mt-6">
        Tüm fiyatları görün
      </Link>
    </section>
  );
}
