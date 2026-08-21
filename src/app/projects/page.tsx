import type { Metadata } from 'next';
import { BRAND_SITE_URL } from '@/lib/site';
import { CorporateCta } from '@/components/CorporateCta';
import { TicketGoProduct } from '@/components/TicketGoProduct';
import { SolutionsSection } from '@/components/home/SolutionsSection';

export const metadata: Metadata = {
  title: 'Ürünler / Projeler',
  description:
    'TicketGo Teknoloji A.Ş. tarafından geliştirilebilen kurumsal yazılım, CRM, SaaS ve dijital platform senaryoları.',
  alternates: { canonical: `${BRAND_SITE_URL}/projects` },
};

export default function ProjectsPage() {
  return (
    <main>
      <section className="section-wrap section-y">
        <h1 className="section-title">Ürünler / Projeler</h1>
        <p className="section-subtitle">
          TicketGo Teknoloji A.Ş. uçtan uca dijital ürünler geliştirir. Aşağıdaki başlıklar geliştirebildiğimiz çözüm
          türlerini temsil eder; şirket tek bir ürünle sınırlı değildir.
        </p>
        <div className="mt-10">
          <TicketGoProduct heading="Dijital Platform Ürün Omurgası" />
        </div>
      </section>
      <SolutionsSection />
      <CorporateCta href="/contact" />
    </main>
  );
}
