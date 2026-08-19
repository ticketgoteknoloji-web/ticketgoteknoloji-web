import type { Metadata } from 'next';
import { KvkkContent } from '@/components/legal/KvkkContent';
import { BRAND_SITE_URL } from '@/lib/site';

export const metadata: Metadata = {
  title: 'KVKK Aydınlatma Metni',
  description:
    'TicketGo Teknoloji A.Ş. 6698 sayılı Kanun aydınlatma metni. Veri sorumlusu, işlenen kategoriler, amaçlar, hukuki sebepler ve ilgili kişi hakları.',
  alternates: { canonical: `${BRAND_SITE_URL}/kvkk` },
};

export default function KvkkPage() {
  return (
    <main className="mx-auto w-full max-w-[920px] px-4 py-12 sm:px-6 sm:py-16">
      <KvkkContent />
    </main>
  );
}
