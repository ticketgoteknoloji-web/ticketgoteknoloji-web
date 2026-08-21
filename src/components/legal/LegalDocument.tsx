import Link from 'next/link';
import { COMPANY, incompleteRegistryFields } from '@/config/company';
import { formatLegalDate, LEGAL_VERSIONS } from '@/lib/legal/versions';

type DocMeta = (typeof LEGAL_VERSIONS)[keyof typeof LEGAL_VERSIONS];

export type LegalTocItem = {
  id: string;
  label: string;
};

type LegalPageShellProps = {
  title: string;
  eyebrow?: string;
  description?: string;
  version?: string;
  lastUpdated?: string;
  children: React.ReactNode;
  tableOfContents?: LegalTocItem[];
  showRegistryNotice?: boolean;
  /** When true, omit the outer <main> (e.g. nested layouts). */
  asFragment?: boolean;
};

function slugifyHeading(label: string): string {
  const map: Record<string, string> = {
    ç: 'c',
    Ç: 'c',
    ğ: 'g',
    Ğ: 'g',
    ı: 'i',
    I: 'i',
    İ: 'i',
    ö: 'o',
    Ö: 'o',
    ş: 's',
    Ş: 's',
    ü: 'u',
    Ü: 'u',
    â: 'a',
    Â: 'a',
  };
  return label
    .split('')
    .map((ch) => map[ch] ?? ch)
    .join('')
    .toLocaleLowerCase('tr-TR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

/**
 * Shared Legal Document Center shell — consistent chrome for all legal pages.
 * Does not invent legal text; only presents children.
 */
export function LegalPageShell({
  title,
  eyebrow = 'Yasal Belgeler',
  description,
  version,
  lastUpdated,
  children,
  tableOfContents,
  showRegistryNotice = true,
  asFragment = false,
}: LegalPageShellProps) {
  const incomplete = incompleteRegistryFields();
  const toc = tableOfContents?.filter((item) => item.id && item.label) ?? [];

  const body = (
    <>
      <header className="legal-shell-hero">
        <p className="legal-shell-eyebrow">{eyebrow}</p>
        <h1 className="legal-shell-title">{title}</h1>
        {description ? <p className="legal-shell-desc">{description}</p> : null}
        <div className="legal-shell-meta">
          <span className="legal-shell-company">{COMPANY.legalName}</span>
          {version || lastUpdated ? (
            <span className="legal-shell-meta-sep" aria-hidden>
              ·
            </span>
          ) : null}
          {version ? <span>Sürüm {version}</span> : null}
          {version && lastUpdated ? (
            <span className="legal-shell-meta-sep" aria-hidden>
              ·
            </span>
          ) : null}
          {lastUpdated ? <span>Son güncelleme: {formatLegalDate(lastUpdated)}</span> : null}
        </div>
      </header>

      {showRegistryNotice && incomplete.length > 0 ? (
        <aside className="legal-callout legal-callout--notice no-print" role="note">
          <p className="legal-callout-label">Bilgilendirme</p>
          <p>
            Sicil, KEP ve iade adresi gibi alanlar hukuk/sicil teyidine tabidir. Teyit edilmemiş alanlar
            belgelerde kontrollü biçimde işaretlenir; production satışından önce tamamlanmalıdır.
          </p>
        </aside>
      ) : null}

      <div className={`legal-shell-layout${toc.length > 0 ? ' legal-shell-layout--with-toc' : ''}`}>
        {toc.length > 0 ? (
          <nav className="legal-toc no-print" aria-label="İçindekiler">
            <p className="legal-toc-title">İçindekiler</p>
            <ol className="legal-toc-list">
              {toc.map((item) => (
                <li key={item.id}>
                  <a href={`#${item.id}`}>{item.label}</a>
                </li>
              ))}
            </ol>
          </nav>
        ) : null}

        <div className="legal-shell-surface">
          <article className="legal-body">{children}</article>
        </div>
      </div>

      <footer className="legal-shell-footer">
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
        <nav className="legal-shell-footer-nav no-print" aria-label="Diğer yasal belgeler">
          <Link href="/kvkk">KVKK</Link>
          <Link href="/privacy">Gizlilik</Link>
          <Link href="/terms">Kullanım Koşulları</Link>
          <Link href="/cookies">Çerez Politikası</Link>
          <Link href="/legal/distance-sales">Mesafeli Satış</Link>
          <Link href="/legal/pre-information">Ön Bilgilendirme</Link>
          <Link href="/legal/refund">İptal / İade</Link>
        </nav>
      </footer>
    </>
  );

  if (asFragment) {
    return <div className="legal-document legal-shell">{body}</div>;
  }

  return <main className="legal-document legal-shell">{body}</main>;
}

/** @deprecated Prefer LegalPageShell — kept for gradual migration of LegalDocument(doc) API */
export function LegalDocument({
  doc,
  intro,
  children,
  showRegistryNotice = true,
  tableOfContents,
}: {
  doc: DocMeta;
  intro?: string;
  children: React.ReactNode;
  showRegistryNotice?: boolean;
  tableOfContents?: LegalTocItem[];
}) {
  return (
    <LegalPageShell
      title={doc.title}
      description={intro}
      version={doc.version}
      lastUpdated={doc.updatedAt}
      showRegistryNotice={showRegistryNotice}
      tableOfContents={tableOfContents}
    >
      {children}
    </LegalPageShell>
  );
}

export function LegalSection({
  title,
  id,
  children,
  level = 2,
}: {
  title: string;
  id?: string;
  children: React.ReactNode;
  level?: 2 | 3;
}) {
  const sectionId = id ?? slugifyHeading(title);
  const Heading = level === 3 ? 'h3' : 'h2';

  return (
    <section id={sectionId} className="legal-section scroll-mt-28">
      <Heading className={level === 3 ? 'legal-h3' : 'legal-h2'}>{title}</Heading>
      <div className="legal-section-body">{children}</div>
    </section>
  );
}

export function LegalCallout({
  label = 'Bilgilendirme',
  children,
  variant = 'info',
}: {
  label?: string;
  children: React.ReactNode;
  variant?: 'info' | 'notice' | 'channel';
}) {
  return (
    <aside className={`legal-callout legal-callout--${variant}`} role="note">
      <p className="legal-callout-label">{label}</p>
      <div className="legal-callout-body">{children}</div>
    </aside>
  );
}

export function legalTocFromTitles(titles: string[]): LegalTocItem[] {
  return titles.map((label) => ({ id: slugifyHeading(label), label }));
}
