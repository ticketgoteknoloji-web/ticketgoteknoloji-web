import {
  BRAND_ADDRESS,
  BRAND_INFO_EMAIL,
  BRAND_DOMAIN,
  BRAND_KVKK_EMAIL,
  BRAND_LEGAL_NAME,
  BRAND_MERSIS,
  BRAND_PHONE_DISPLAY,
  BRAND_PHONE_HREF,
  BRAND_SITE_URL,
  BRAND_SUPPORT_EMAIL,
  BRAND_TAX_NUMBER,
  BRAND_TAX_OFFICE,
  BRAND_WHATSAPP_NUMBER,
} from '@/lib/site';

/**
 * Confirmed fields are published on legal pages. Remaining `missing` / `needs_legal_review`
 * items (KEP, ticaret sicili, iade adresi) still render as placeholders.
 */
export type RegistryStatus = 'confirmed' | 'needs_legal_review' | 'missing';

export type RegistryField = {
  status: RegistryStatus;
  value: string;
  placeholder: string;
};

function field(status: RegistryStatus, value: string, placeholder: string): RegistryField {
  return { status, value, placeholder };
}

export const COMPANY = {
  legalName: BRAND_LEGAL_NAME,
  websiteDisplay: `www.${BRAND_DOMAIN}`,
  websiteUrl: BRAND_SITE_URL,
  emails: {
    info: BRAND_INFO_EMAIL,
    support: BRAND_SUPPORT_EMAIL,
    kvkk: BRAND_KVKK_EMAIL,
  },
  phone: field('needs_legal_review', BRAND_PHONE_DISPLAY, '[TELEFON EKLENECEK]'),
  phoneHref: BRAND_PHONE_HREF,
  /** E.164 without '+'. Empty = WhatsApp not yet confirmed. */
  whatsapp: BRAND_WHATSAPP_NUMBER,
  address: field('confirmed', BRAND_ADDRESS, '[ŞİRKET MERKEZ ADRESİ EKLENECEK]'),
  taxNumber: field('confirmed', BRAND_TAX_NUMBER, '[VERGİ NO EKLENECEK]'),
  taxOffice: field('confirmed', BRAND_TAX_OFFICE, '[VERGİ DAİRESİ EKLENECEK]'),
  mersis: field('confirmed', BRAND_MERSIS, '[MERSİS NO EKLENECEK]'),
  tradeRegistryNumber: field('missing', '', '[TİCARET SİCİL NUMARASI EKLENECEK]'),
  tradeRegistryOffice: field('missing', '', '[TİCARET SİCİL MÜDÜRLÜĞÜ EKLENECEK]'),
  kep: field('missing', '', '[KEP ADRESİ EKLENECEK]'),
  returnAddress: field('missing', '', '[İADE FİZİKSEL ADRESİ EKLENECEK]'),
} as const;

export function displayRegistry(field: RegistryField): string {
  if (field.status === 'confirmed' && field.value.trim()) return field.value;
  return field.placeholder;
}

/** True when a real value exists (even if still under legal review). */
export function hasRegistryValue(field: RegistryField): boolean {
  return Boolean(field.value.trim());
}

/**
 * Prefer real configured values for UI panels. Falls back to placeholder only when empty.
 * Does not invent company data.
 */
export function displayRegistryPreferValue(field: RegistryField): string {
  if (field.value.trim()) return field.value.trim();
  return field.placeholder;
}

export function displayTaxLine(): string {
  const officeConfirmed = COMPANY.taxOffice.status === 'confirmed';
  const numberConfirmed = COMPANY.taxNumber.status === 'confirmed';
  if (!officeConfirmed && !numberConfirmed) return '[VERGİ DAİRESİ / VERGİ NO EKLENECEK]';
  return `${displayRegistry(COMPANY.taxOffice)} / ${displayRegistry(COMPANY.taxNumber)}`;
}

export function incompleteRegistryFields(): Array<{ key: string; placeholder: string; status: RegistryStatus }> {
  return (
    [
      ['address', COMPANY.address],
      ['phone', COMPANY.phone],
      ['taxOffice', COMPANY.taxOffice],
      ['taxNumber', COMPANY.taxNumber],
      ['mersis', COMPANY.mersis],
      ['tradeRegistryNumber', COMPANY.tradeRegistryNumber],
      ['tradeRegistryOffice', COMPANY.tradeRegistryOffice],
      ['kep', COMPANY.kep],
      ['returnAddress', COMPANY.returnAddress],
    ] as Array<[string, RegistryField]>
  )
    .filter(([, item]) => item.status !== 'confirmed')
    .map(([key, item]) => ({ key, placeholder: item.placeholder, status: item.status }));
}
