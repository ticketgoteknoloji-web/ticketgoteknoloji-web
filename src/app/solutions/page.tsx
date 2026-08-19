import type { Metadata } from 'next';
import { CorporateCta } from '@/components/CorporateCta';
import { ServicesSection } from '@/components/home/ServicesSection';
import { BRAND_SITE_URL } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Çözümler',
  description:
    'TicketGo Teknoloji; özel yazılım, kurumsal CRM, SaaS, rezervasyon, operasyon yönetimi, web ve mobil uygulama, API entegrasyonu, iş süreçleri otomasyonu ve yapay zekâ entegrasyonu çözümleri geliştirir.',
  alternates: { canonical: `${BRAND_SITE_URL}/solutions` },
};

export default function SolutionsPage() {
  return (
    <main>
      <ServicesSection headingAs="h1" />
      <CorporateCta href="/contact" />
    </main>
  );
}
