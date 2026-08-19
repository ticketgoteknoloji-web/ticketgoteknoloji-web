import type { Metadata } from 'next';
import { PrivacyContent } from '@/components/legal/PrivacyContent';
import { BRAND_SITE_URL } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Gizlilik ve Kişisel Verilerin Korunması Politikası',
  description:
    'TicketGo Teknoloji A.Ş. gizlilik ve kişisel verilerin korunması politikası. Veri sorumlusu, işleme amaçları, aktarım, haklar ve başvuru yöntemi.',
  alternates: { canonical: `${BRAND_SITE_URL}/privacy` },
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-[920px] px-4 py-12 sm:px-6 sm:py-16">
      <PrivacyContent />
    </main>
  );
}
