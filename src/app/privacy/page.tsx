import type { Metadata } from 'next';
import { PrivacyContent, PRIVACY_TOC } from '@/components/legal/PrivacyContent';
import { LegalPageShell } from '@/components/legal/LegalDocument';
import { LEGAL_VERSIONS } from '@/lib/legal/versions';
import { BRAND_SITE_URL } from '@/lib/site';

const doc = LEGAL_VERSIONS.privacy;

export const metadata: Metadata = {
  title: 'Gizlilik Politikası',
  description:
    'TicketGo Teknoloji A.Ş. gizlilik ve kişisel verilerin korunması politikası. Veri sorumlusu, işleme amaçları, aktarım, haklar ve başvuru yöntemi.',
  alternates: { canonical: `${BRAND_SITE_URL}/privacy` },
};

export default function PrivacyPage() {
  return (
    <LegalPageShell
      title={doc.title}
      eyebrow="Gizlilik"
      description="TicketGo Teknoloji A.Ş. olarak kişisel verilerin gizliliğine, güvenliğine ve yürürlükteki veri koruma mevzuatına uygun biçimde işlenmesine önem veriyoruz."
      version={doc.version}
      lastUpdated={doc.updatedAt}
      tableOfContents={[...PRIVACY_TOC]}
    >
      <PrivacyContent omitChrome />
    </LegalPageShell>
  );
}
