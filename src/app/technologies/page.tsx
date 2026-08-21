import type { Metadata } from 'next';
import { CorporateCta } from '@/components/CorporateCta';
import { TicketGoProduct } from '@/components/TicketGoProduct';
import {
  TechnologiesAiCard,
  TechnologiesArchitecture,
  TechnologiesStackGrid,
} from '@/components/TechnologiesFeatureGrids';
import { BRAND_SITE_URL } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Teknolojiler',
  description:
    'TicketGo Teknoloji; React, Next.js, Node.js, REST API, veri, cloud, CI/CD ve yapay zekâ entegrasyonlarıyla güvenli ve ölçeklenebilir yazılım altyapıları tasarlar.',
  alternates: { canonical: `${BRAND_SITE_URL}/technologies` },
};

export default function TechnologiesPage() {
  return (
    <main>
      <section className="hero-section hero-accent">
        <div className="section-wrap section-y">
          <h1 className="section-title">Modern Teknolojiler. Güçlü Dijital Ürünler.</h1>
          <p className="section-subtitle">
            İhtiyaca uygun teknoloji seçimleriyle performanslı, güvenli, sürdürülebilir ve ölçeklenebilir sistemler tasarlıyoruz.
          </p>
        </div>
      </section>

      <section className="section-muted">
        <div className="section-wrap pb-16">
          <TechnologiesStackGrid />
        </div>
      </section>

      <section className="section-muted">
        <div id="ai" className="section-wrap scroll-section pb-16 lg:pb-24">
          <TechnologiesAiCard />
        </div>
      </section>

      <section className="section-wrap pb-16">
        <h2 className="section-title">Teknolojinin ürüne dönüştüğü yer</h2>
        <p className="section-subtitle">
          Bu şema teknik bir mimari belgesi değil; TicketGo Teknoloji’nin geliştirebildiği modern ürün ekosisteminin görsel
          temsilidir. Projenin gerçek mimarisi ihtiyaca göre şekillenir.
        </p>
        <TechnologiesArchitecture />
      </section>

      <section className="section-wrap pb-8">
        <TicketGoProduct heading="Ürüne dönüşen teknoloji yaklaşımı" compact />
      </section>
      <CorporateCta href="/contact" />
    </main>
  );
}
