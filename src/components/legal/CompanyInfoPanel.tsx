import type { ReactNode } from 'react';
import {
  COMPANY,
  displayRegistryPreferValue,
  hasRegistryValue,
  incompleteRegistryFields,
} from '@/config/company';

type CompanyInfoPanelProps = {
  title: string;
  showSupport?: boolean;
  showKvkk?: boolean;
  showInfo?: boolean;
  infoLabel?: string;
  showPhone?: boolean;
};

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid min-w-0 gap-1 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-4">
      <dt className="font-semibold text-ink">{label}</dt>
      <dd className="min-w-0 break-words text-muted">{children}</dd>
    </div>
  );
}

export function CompanyInfoPanel({
  title,
  showSupport = true,
  showKvkk = false,
  showInfo = true,
  infoLabel = 'E-posta',
  showPhone = true,
}: CompanyInfoPanelProps) {
  const incomplete = incompleteRegistryFields().filter((item) => {
    const map: Record<string, { value: string }> = {
      address: COMPANY.address,
      phone: COMPANY.phone,
      taxOffice: COMPANY.taxOffice,
      taxNumber: COMPANY.taxNumber,
      mersis: COMPANY.mersis,
      tradeRegistryNumber: COMPANY.tradeRegistryNumber,
      tradeRegistryOffice: COMPANY.tradeRegistryOffice,
      kep: COMPANY.kep,
      returnAddress: COMPANY.returnAddress,
    };
    return !map[item.key]?.value?.trim();
  });

  return (
    <div className="legal-company-panel text-sm leading-7">
      <h3>{title}</h3>
      <dl className="space-y-3">
        <Row label="Ticaret Unvanı">{COMPANY.legalName}</Row>
        {hasRegistryValue(COMPANY.taxOffice) ? (
          <Row label="Vergi Dairesi">{displayRegistryPreferValue(COMPANY.taxOffice)}</Row>
        ) : null}
        {hasRegistryValue(COMPANY.taxNumber) ? (
          <Row label="Vergi Numarası">{displayRegistryPreferValue(COMPANY.taxNumber)}</Row>
        ) : null}
        {hasRegistryValue(COMPANY.mersis) ? (
          <Row label="MERSİS No">{displayRegistryPreferValue(COMPANY.mersis)}</Row>
        ) : null}
        {hasRegistryValue(COMPANY.address) ? (
          <Row label="Adres">{displayRegistryPreferValue(COMPANY.address)}</Row>
        ) : null}
        <Row label="Web">
          <a href={COMPANY.websiteUrl} className="font-semibold text-brand-600 break-all">
            {COMPANY.websiteDisplay}
          </a>
        </Row>
        {showPhone && hasRegistryValue(COMPANY.phone) ? (
          <Row label="Telefon">
            <a href={COMPANY.phoneHref} className="font-semibold text-brand-600">
              {displayRegistryPreferValue(COMPANY.phone)}
            </a>
          </Row>
        ) : null}
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
      {incomplete.length > 0 ? (
        <p className="mt-3 text-xs leading-5 text-muted">
          Ticaret sicili, KEP veya iade adresi gibi teyit bekleyen alanlar bu panelde gösterilmez; ilgili yasal
          belgelerde kontrollü biçimde yer alır.
        </p>
      ) : null}
    </div>
  );
}
