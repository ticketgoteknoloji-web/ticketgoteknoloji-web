export const BRAND_NAME = 'ticket Go';
export const BRAND_LEGAL_NAME = 'TicketGo Teknoloji A.Ş.';
export const BRAND_SITE_URL = 'https://www.ticketgoteknoloji.com';
export const BRAND_DOMAIN = 'ticketgoteknoloji.com';
export const BRAND_TAGLINE =
  'Kurumsal yazılım, CRM, SaaS, dijital platform, web ve mobil uygulama, API, otomasyon ve yapay zekâ entegrasyonları geliştiriyoruz.';

export const BRAND_INFO_EMAIL = 'info@ticketgoteknoloji.com';
export const BRAND_SUPPORT_EMAIL = 'destek@ticketgoteknoloji.com';
export const BRAND_KVKK_EMAIL = 'kvkk@ticketgoteknoloji.com';

export const BRAND_CONTACT_CHANNELS = [
  { label: 'Genel İletişim', email: BRAND_INFO_EMAIL },
  { label: 'Teknik Destek', email: BRAND_SUPPORT_EMAIL },
  { label: 'KVKK Başvuruları', email: BRAND_KVKK_EMAIL },
] as const;

export const BRAND_PHONE_DISPLAY = '0547 319 50 05';
export const BRAND_PHONE_HREF = 'tel:+905473195005';

/**
 * Official WhatsApp number in E.164 format without leading +.
 * Example: '905473195005' for a Turkish number.
 * Leave empty until the number is confirmed as WhatsApp-enabled.
 * ⚠ WHATSAPP NUMARASI EKSİK — RESMİ NUMARA GİRİLMELİ
 */
export const BRAND_WHATSAPP_NUMBER = '905473195005';

export const BRAND_ADDRESS = 'Gümbet Mah. Mister Hadi Sok. No:2-A1 Bodrum/MUĞLA';
export const BRAND_TAX_OFFICE = 'Bodrum Vergi Dairesi';
export const BRAND_TAX_NUMBER = '8430931108';
export const BRAND_MERSIS = '0843093110800001';

export const BRAND_HOURS = ['Pazartesi–Cuma, 09:00–18:00', 'Cumartesi, 09:00–12:00'] as const;

/** Corporate platform capability label — not an external ferry product brand. */
export const PRODUCT_PLATFORM_LABEL = 'Dijital Platform';

export const CONTACT_ENDPOINT = '/api/contact';
