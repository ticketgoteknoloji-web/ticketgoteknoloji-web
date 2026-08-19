import type { Metadata } from 'next';
import { BRAND_SITE_URL } from '@/lib/site';
import { CorporateCta } from '@/components/CorporateCta';
import { TicketGoProduct } from '@/components/TicketGoProduct';
import { SolutionsSection } from '@/components/home/SolutionsSection';

export const metadata: Metadata = {
  title: 'Ürünler / Projeler',
  description:
    'Ticket-Go rezervasyon ve biletleme platformu ile TicketGo Teknoloji A.Ş. tarafından geliştirilebilen kurumsal yazılım, CRM ve dijital platform senaryoları.',
  alternates: { canonical: `${BRAND_SITE_URL}/projects` },
};

export default function ProjectsPage() {
  return (
    <main>
      <section className="section-wrap section-y">
        <h1 className="section-title">Ürünler / Projeler</h1>
        <p className="section-subtitle">
          Ticket-Go, TicketGo Teknoloji A.Ş. tarafından geliştirilen bir ürün örneğidir. Şirket bu ürünle sınırlı değildir;
          aşağıdaki başlıklar geliştirebildiğimiz çözüm türlerini temsil eder.
        </p>
        <div className="mt-10">
          <TicketGoProduct heading="Ticket-Go" />
        </div>
      </section>
      <SolutionsSection />
      <CorporateCta href="/contact" />
    </main>
  );
}
