import type { Metadata } from 'next';
import { CorporateCta } from '@/components/CorporateCta';
import { PricingView } from '@/components/pricing/PricingView';
import { BRAND_LEGAL_NAME, BRAND_SITE_URL } from '@/lib/site';
import { pricingCatalog } from '@/lib/pricing';

const DESCRIPTION =
  'Ticket-Go platformu, özel yazılım, AI entegrasyonu ve bakım paketleri için USD başlangıç fiyatları. Prices in USD. Taxes may apply.';

export const metadata: Metadata = {
  title: 'Fiyatlandırma',
  description: DESCRIPTION,
  alternates: { canonical: `${BRAND_SITE_URL}/pricing` },
  keywords: ['yazılım fiyatlandırma', 'SaaS fiyat', 'özel yazılım maliyeti', 'Ticket-Go', 'AI entegrasyon fiyatı'],
  openGraph: {
    title: `Fiyatlandırma | ${BRAND_LEGAL_NAME}`,
    description:
      'Ürün, hizmet ve bakım için USD fiyatları. Sabit fiyatlı paketler ödeme sayfasına, özel kapsamlı işler teklif formuna gider.',
    url: `${BRAND_SITE_URL}/pricing`,
    locale: 'tr_TR',
    type: 'website',
  },
};

export default function PricingPage() {
  const offers = [
    ...pricingCatalog.plans,
    ...pricingCatalog.services,
    ...pricingCatalog.aiPlans,
    ...pricingCatalog.supportPlans,
  ]
    .filter((item) => item.monthlyPrice || item.setupFee)
    .map((item) => ({
      '@type': 'Offer',
      name: item.name,
      description: item.description,
      url: `${BRAND_SITE_URL}/pricing`,
      priceCurrency: pricingCatalog.currency,
      price: String(item.monthlyPrice ?? item.setupFee ?? ''),
      availability: 'https://schema.org/InStock',
    }));

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'OfferCatalog',
    name: `${BRAND_LEGAL_NAME} Fiyatlandırma`,
    url: `${BRAND_SITE_URL}/pricing`,
    description: DESCRIPTION,
    itemListElement: offers,
  };

  return (
    <main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <PricingView />
      <CorporateCta href="/contact?need=Fiyatlandırma%20Teklifi" />
    </main>
  );
}
