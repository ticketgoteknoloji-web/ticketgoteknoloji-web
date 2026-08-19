import type { Metadata } from 'next';
import { BRAND_SITE_URL } from '@/lib/site';
import { CookiesContent } from '@/components/legal/CookiesContent';

export const metadata: Metadata = {
  title: 'Çerez Politikası',
  description:
    'TicketGo Teknoloji A.Ş. çerez politikası. Zorunlu, performans, tercih ve güvenlik çerezleri hakkında bilgilendirme.',
  alternates: { canonical: `${BRAND_SITE_URL}/cookies` },
};

export default function CookiesPage() {
  return (
    <main className="legal-document mx-auto w-full max-w-[920px] px-4 py-12 sm:px-6 sm:py-16">
      <CookiesContent />
    </main>
  );
}
