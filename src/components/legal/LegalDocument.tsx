import Link from 'next/link';
import { COMPANY, displayRegistry, incompleteRegistryFields } from '@/config/company';
import { formatLegalDate, LEGAL_VERSIONS } from '@/lib/legal/versions';

type DocMeta = (typeof LEGAL_VERSIONS)[keyof typeof LEGAL_VERSIONS];

type LegalDocumentProps = {
  doc: DocMeta;
  intro?: string;
  children: React.ReactNode;
  showRegistryNotice?: boolean;
};

export function LegalDocument({ doc, intro, children, showRegistryNotice = true }: LegalDocumentProps) {
  const incomplete = incompleteRegistryFields();

  return (
    <main className="legal-document mx-auto w-full max-w-[920px] px-4 py-12 sm:px-6 sm:py-16">
      <p className="text-sm font-medium text-brand-700">{COMPANY.legalName}</p>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">{doc.title}</h1>
      <p className="mt-3 text-sm text-muted">
        Sürüm {doc.version} · Son güncelleme: {formatLegalDate(doc.updatedAt)}
      </p>
      {intro ? <p className="mt-6 text-base leading-8 text-ink">{intro}</p> : null}
      {showRegistryNotice && incomplete.length > 0 ? (
        <aside className="legal-notice mt-6 border border-line bg-canvas px-4 py-3 text-sm leading-6 text-muted">
          Sicil, vergi dairesi, KEP ve iade adresi gibi alanlar hukuk/sicil teyidine tabidir. Teyit edilmeyen
          bilgiler köşeli parantezle gösterilir; production satışından önce tamamlanmalıdır.
        </aside>
      ) : null}
      <article className="legal-body mt-10 space-y-8 text-base leading-8 text-ink">{children}</article>
      <footer className="mt-12 border-t border-line pt-6 text-sm leading-7 text-muted">
        <p>
          {COMPANY.legalName} · {COMPANY.websiteDisplay} ·{' '}
          <a className="email-link font-semibold text-brand-600" href={`mailto:${COMPANY.emails.info}`}>
            {COMPANY.emails.info}
          </a>
        </p>
        <p>
          Destek:{' '}
          <a className="email-link font-semibold text-brand-600" href={`mailto:${COMPANY.emails.support}`}>
            {COMPANY.emails.support}
          </a>
          {' · '}
          KVKK:{' '}
          <a className="email-link font-semibold text-brand-600" href={`mailto:${COMPANY.emails.kvkk}`}>
            {COMPANY.emails.kvkk}
          </a>
        </p>
        <p>
          Adres: {displayRegistry(COMPANY.address)} · Tel: {displayRegistry(COMPANY.phone)}
        </p>
        <div className="no-print mt-4 flex flex-wrap gap-4">
          <Link href="/legal/distance-sales" className="font-semibold text-brand-600">
            Mesafeli Satış
          </Link>
          <Link href="/legal/pre-information" className="font-semibold text-brand-600">
            Ön Bilgilendirme
          </Link>
          <Link href="/legal/refund" className="font-semibold text-brand-600">
            İptal / İade
          </Link>
          <Link href="/kvkk" className="font-semibold text-brand-600">
            KVKK
          </Link>
          <Link href="/privacy" className="font-semibold text-brand-600">
            Gizlilik
          </Link>
        </div>
      </footer>
    </main>
  );
}

export function LegalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-xl font-semibold text-ink">{title}</h2>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}
