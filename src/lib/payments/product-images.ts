/**
 * Centralised product-image mapping for the payment pages.
 * All files live under /public/images/payment/products/.
 */

const BASE = '/images/payment/products';

export const PAYMENT_PRODUCT_IMAGES: Record<string, { src: string; alt: string }> = {
  'ticketgo-starter':     { src: `${BASE}/ticketgo-starter.webp`,     alt: 'Platform Starter dijital ürün paketi' },
  'ticketgo-growth':      { src: `${BASE}/ticketgo-growth.webp`,      alt: 'Platform Growth dijital ürün paketi' },
  'ticketgo-scale':       { src: `${BASE}/ticketgo-scale.webp`,       alt: 'Platform Scale kurumsal paket' },
  'discovery':            { src: `${BASE}/discovery.webp`,            alt: 'Dijital ürün keşif ve analiz hizmeti' },
  'ai-starter':           { src: `${BASE}/ai-starter.webp`,           alt: 'Yapay zekâ entegrasyonu Starter paketi' },
  'ai-growth':            { src: `${BASE}/ai-growth.webp`,            alt: 'Yapay zekâ entegrasyonu Growth paketi' },
  'ai-scale':             { src: `${BASE}/ai-scale.webp`,             alt: 'Yapay zekâ entegrasyonu Scale paketi' },
  'support-essential':    { src: `${BASE}/support-essential.webp`,    alt: 'Essential teknik destek paketi' },
  'support-professional': { src: `${BASE}/support-professional.webp`, alt: 'Professional teknik bakım paketi' },
  'support-mission':      { src: `${BASE}/support-mission.webp`,      alt: 'Mission Critical yüksek öncelikli destek' },
  'extra-operator-seat':  { src: `${BASE}/extra-operator-seat.webp`,  alt: 'Ek operatör kullanıcı koltuğu' },
  'extra-support-hour':   { src: `${BASE}/extra-support-hour.webp`,   alt: 'Ek destek ve geliştirme saati' },
  'extra-environment':    { src: `${BASE}/extra-environment.webp`,    alt: 'Ek staging veya eğitim ortamı' },
};

const DEFAULT_IMAGE = { src: `${BASE}/default-product.webp`, alt: 'TicketGo Teknoloji ürün ve hizmet' };

export function getProductImage(productId: string): { src: string; alt: string } {
  return PAYMENT_PRODUCT_IMAGES[productId] ?? DEFAULT_IMAGE;
}
