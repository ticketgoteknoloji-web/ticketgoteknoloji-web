export const LEGAL_VERSIONS = {
  distanceSales: {
    id: 'distance-sales',
    version: '2026.08-v1',
    updatedAt: '2026-08-18',
    title: 'Mesafeli Satış Sözleşmesi',
    href: '/legal/distance-sales',
  },
  preInformation: {
    id: 'pre-information',
    version: '2026.08-v1',
    updatedAt: '2026-08-18',
    title: 'Mesafeli Satış Ön Bilgilendirme Formu',
    href: '/legal/pre-information',
  },
  refund: {
    id: 'refund',
    version: '2026.08-v1',
    updatedAt: '2026-08-18',
    title: 'İptal, Cayma ve İade Koşulları',
    href: '/legal/refund',
  },
  kvkk: {
    id: 'kvkk',
    version: '2026.08-v1',
    updatedAt: '2026-08-18',
    title: 'KVKK Aydınlatma Metni',
    href: '/kvkk',
  },
  privacy: {
    id: 'privacy',
    version: '2026.08-v2',
    updatedAt: '2026-08-19',
    title: 'Gizlilik ve Kişisel Verilerin Korunması Politikası',
    href: '/privacy',
  },
} as const;

export type LegalDocumentId = keyof typeof LEGAL_VERSIONS;

export function formatLegalDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }).format(
    new Date(year, month - 1, day)
  );
}
