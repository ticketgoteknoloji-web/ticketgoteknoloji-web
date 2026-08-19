import type { Metadata } from 'next';
import { BRAND_LEGAL_NAME, BRAND_SITE_URL } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Kullanım Koşulları',
  description: 'TicketGo Teknoloji A.Ş. web sitesi kullanım koşulları.',
  alternates: { canonical: `${BRAND_SITE_URL}/terms` },
};

export default function TermsPage() {
  return (
    <main className="legal-document mx-auto w-full max-w-[920px] px-4 py-12 sm:px-6 sm:py-16">
      <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">Kullanım Koşulları</h1>
      <article className="mt-8 space-y-6 text-base leading-8 text-muted">
        <p>
          Bu web sitesini kullanan tüm ziyaretçiler, {BRAND_LEGAL_NAME} tarafından yayınlanan kullanım koşullarını kabul etmiş sayılır.
        </p>
        <p>
          Sitede yer alan içeriklerin fikri mülkiyet hakları saklıdır. İzinsiz kopyalama, dağıtım veya ticari kullanım yapılamaz.
        </p>
        <p>
          İçerikler bilgilendirme amacı taşır. Proje, hizmet kapsamı ve teklif süreçleri ayrıca yazılı mutabakat ile yürütülür.
        </p>
      </article>
    </main>
  );
}
