import type { Metadata } from 'next';
import { CookiesContent, COOKIES_TOC } from '@/components/legal/CookiesContent';
import { LegalPageShell } from '@/components/legal/LegalDocument';
import { BRAND_SITE_URL } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Çerez Politikası',
  description:
    'TicketGo Teknoloji A.Ş. çerez politikası. Zorunlu, performans, tercih ve güvenlik çerezleri hakkında bilgilendirme.',
  alternates: { canonical: `${BRAND_SITE_URL}/cookies` },
};

export default function CookiesPage() {
  return (
    <LegalPageShell
      title="Çerez Politikası"
      eyebrow="Çerezler"
      description="Kurumsal web sitesinde kullanılan sınırlı teknik çerezler hakkında bilgilendirme. Reklam veya üçüncü taraf izleme çerezleri kullanılmamaktadır."
      lastUpdated="2026-08-19"
      tableOfContents={[...COOKIES_TOC]}
      showRegistryNotice={false}
    >
      <CookiesContent omitChrome />
    </LegalPageShell>
  );
}
