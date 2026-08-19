import type { ReactNode } from 'react';
import { COMPANY, displayRegistry } from '@/config/company';

type CompanyInfoPanelProps = {
  title: string;
  showSupport?: boolean;
  showKvkk?: boolean;
  showInfo?: boolean;
  infoLabel?: string;
};

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid min-w-0 gap-1 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-4">
      <dt className="font-semibold text-ink">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}

export function CompanyInfoPanel({
  title,
  showSupport = true,
  showKvkk = false,
  showInfo = true,
  infoLabel = 'E-posta',
}: CompanyInfoPanelProps) {
  return (
    <div className="legal-summary border border-line bg-canvas px-4 py-4 text-sm leading-7">
      <h3 className="font-semibold text-ink">{title}</h3>
      <dl className="mt-3 space-y-3">
        <Row label="Ticaret Unvanı">{COMPANY.legalName}</Row>
        <Row label="Vergi Dairesi">{displayRegistry(COMPANY.taxOffice)}</Row>
        <Row label="Vergi Numarası">{displayRegistry(COMPANY.taxNumber)}</Row>
        <Row label="MERSİS No">{displayRegistry(COMPANY.mersis)}</Row>
        <Row label="Adres">{displayRegistry(COMPANY.address)}</Row>
        <Row label="Web">
          <a href={COMPANY.websiteUrl} className="font-semibold text-brand-600 break-all">
            {COMPANY.websiteDisplay}
          </a>
        </Row>
        {showInfo ? (
          <Row label={infoLabel}>
            <a className="email-link font-semibold text-brand-600" href={`mailto:${COMPANY.emails.info}`}>
              {COMPANY.emails.info}
            </a>
          </Row>
        ) : null}
        {showSupport ? (
          <Row label="Destek">
            <a className="email-link font-semibold text-brand-600" href={`mailto:${COMPANY.emails.support}`}>
              {COMPANY.emails.support}
            </a>
          </Row>
        ) : null}
        {showKvkk ? (
          <Row label="KVKK İletişim">
            <a className="email-link font-semibold text-brand-600" href={`mailto:${COMPANY.emails.kvkk}`}>
              {COMPANY.emails.kvkk}
            </a>
          </Row>
        ) : null}
      </dl>
    </div>
  );
}
