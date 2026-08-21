import type { Metadata } from 'next';
import { KvkkContent, KVKK_TOC } from '@/components/legal/KvkkContent';
import { LegalPageShell } from '@/components/legal/LegalDocument';
import { LEGAL_VERSIONS } from '@/lib/legal/versions';
import { BRAND_SITE_URL } from '@/lib/site';

const doc = LEGAL_VERSIONS.kvkk;

export const metadata: Metadata = {
  title: 'KVKK Aydınlatma Metni',
  description:
    'TicketGo Teknoloji A.Ş. 6698 sayılı Kanun aydınlatma metni. Veri sorumlusu, işlenen kategoriler, amaçlar, hukuki sebepler ve ilgili kişi hakları.',
  alternates: { canonical: `${BRAND_SITE_URL}/kvkk` },
};

export default function KvkkPage() {
  return (
    <LegalPageShell
      title={doc.title}
      eyebrow="KVKK"
      description="6698 sayılı Kişisel Verilerin Korunması Kanunu kapsamında veri sorumlusu sıfatıyla TicketGo Teknoloji A.Ş. tarafından kişisel verilerinizin işlenmesine ilişkin aydınlatma metni."
      version={doc.version}
      lastUpdated={doc.updatedAt}
      tableOfContents={[...KVKK_TOC]}
    >
      <KvkkContent omitChrome />
    </LegalPageShell>
  );
}
