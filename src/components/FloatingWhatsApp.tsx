'use client';

import { createWhatsAppLink } from '@/lib/mailto';
import { BRAND_WHATSAPP_NUMBER } from '@/lib/site';
import { WhatsAppIcon } from './WhatsAppButton';

const DEFAULT_MESSAGE = 'Merhaba TicketGo Teknoloji, hizmetleriniz hakkında bilgi almak istiyorum.';

/**
 * Fixed floating WhatsApp button — bottom-right corner.
 * Renders nothing when BRAND_WHATSAPP_NUMBER is not yet configured.
 * Positioned to avoid overlapping payment forms, cookie banners, and mobile CTAs.
 */
export function FloatingWhatsApp() {
  const href = createWhatsAppLink({ phone: BRAND_WHATSAPP_NUMBER, message: DEFAULT_MESSAGE });
  if (!href) return null;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="WhatsApp ile İletişim"
      title="WhatsApp ile İletişim"
      className="group fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg transition-transform duration-200 hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#25D366] focus-visible:ring-offset-2"
    >
      <WhatsAppIcon size={28} />
      <span className="pointer-events-none absolute right-16 hidden whitespace-nowrap rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink shadow-soft group-hover:block">
        WhatsApp ile İletişim
      </span>
    </a>
  );
}
