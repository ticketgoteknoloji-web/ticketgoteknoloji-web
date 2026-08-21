import type { Metadata } from 'next';
import { LegalPageShell, LegalSection } from '@/components/legal/LegalDocument';
import { BRAND_LEGAL_NAME, BRAND_SITE_URL } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Kullanım Koşulları',
  description: 'TicketGo Teknoloji A.Ş. web sitesi kullanım koşulları.',
  alternates: { canonical: `${BRAND_SITE_URL}/terms` },
};

const TOC = [
  { id: 'kabul', label: 'Kabul' },
  { id: 'fikri-mulkiyet', label: 'Fikri mülkiyet' },
  { id: 'bilgilendirme-amaci', label: 'Bilgilendirme amacı' },
] as const;

export default function TermsPage() {
  return (
    <LegalPageShell
      title="Kullanım Koşulları"
      eyebrow="Kullanım"
      description={`${BRAND_LEGAL_NAME} kurumsal web sitesinin kullanımına ilişkin temel koşullar.`}
      lastUpdated="2026-08-18"
      tableOfContents={[...TOC]}
      showRegistryNotice={false}
    >
      <LegalSection id="kabul" title="Kabul">
        <p>
          Bu web sitesini kullanan tüm ziyaretçiler, {BRAND_LEGAL_NAME} tarafından yayınlanan kullanım koşullarını kabul
          etmiş sayılır.
        </p>
      </LegalSection>
      <LegalSection id="fikri-mulkiyet" title="Fikri mülkiyet">
        <p>
          Sitede yer alan içeriklerin fikri mülkiyet hakları saklıdır. İzinsiz kopyalama, dağıtım veya ticari kullanım
          yapılamaz.
        </p>
      </LegalSection>
      <LegalSection id="bilgilendirme-amaci" title="Bilgilendirme amacı">
        <p>
          İçerikler bilgilendirme amacı taşır. Proje, hizmet kapsamı ve teklif süreçleri ayrıca yazılı mutabakat ile
          yürütülür.
        </p>
      </LegalSection>
    </LegalPageShell>
  );
}
