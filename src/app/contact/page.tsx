import type { Metadata } from 'next';
import { Clock3, Mail, MapPin, Phone } from 'lucide-react';
import { ContactForm } from '@/components/ContactForm';
import { SurfaceCard } from '@/components/SurfaceCard';
import { WhatsAppIcon } from '@/components/WhatsAppButton';
import { createWhatsAppLink } from '@/lib/mailto';
import {
  BRAND_ADDRESS,
  BRAND_CONTACT_CHANNELS,
  BRAND_HOURS,
  BRAND_LEGAL_NAME,
  BRAND_PHONE_DISPLAY,
  BRAND_PHONE_HREF,
  BRAND_SITE_URL,
  BRAND_WHATSAPP_NUMBER,
} from '@/lib/site';

export const metadata: Metadata = {
  title: 'İletişim',
  description:
    'TicketGo Teknoloji A.Ş. ile özel yazılım, CRM, SaaS, dijital platform veya entegrasyon projenizi konuşun. info@ticketgoteknoloji.com',
  alternates: { canonical: `${BRAND_SITE_URL}/contact` },
};

export default function ContactPage() {
  return (
    <main className="section-wrap section-y">
      <h1 className="section-title">İletişim</h1>
      <p className="section-subtitle">
        Yeni bir dijital ürün, kurumsal yazılım veya süreç otomasyonu için {BRAND_LEGAL_NAME} ekibiyle iletişime geçin.
      </p>

      <div className="mt-10 grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SurfaceCard>
          <MapPin className="text-brand-500" size={20} aria-hidden />
          <h2 className="mt-4 text-sm font-semibold text-ink">Adres</h2>
          <p className="mt-2 text-sm leading-6 text-muted">{BRAND_ADDRESS}</p>
        </SurfaceCard>
        <SurfaceCard>
          <Phone className="text-brand-500" size={20} aria-hidden />
          <h2 className="mt-4 text-sm font-semibold text-ink">Telefon</h2>
          <a href={BRAND_PHONE_HREF} className="mt-2 block text-sm font-semibold text-brand-600 hover:text-brand-700">
            {BRAND_PHONE_DISPLAY}
          </a>
        </SurfaceCard>
        <SurfaceCard>
          <Mail className="text-brand-500" size={20} aria-hidden />
          <h2 className="mt-4 text-sm font-semibold text-ink">E-posta</h2>
          <div className="mt-2 min-w-0 space-y-3 text-sm">
            {BRAND_CONTACT_CHANNELS.map((channel) => (
              <div key={channel.email}>
                <p className="text-muted">{channel.label}</p>
                <a
                  href={`mailto:${channel.email}`}
                  className="email-link mt-0.5 block font-semibold text-brand-600 hover:text-brand-700"
                >
                  {channel.email}
                </a>
              </div>
            ))}
          </div>
        </SurfaceCard>
        <SurfaceCard>
          <Clock3 className="text-brand-500" size={20} aria-hidden />
          <h2 className="mt-4 text-sm font-semibold text-ink">Çalışma saatleri</h2>
          <div className="mt-2 space-y-1 text-sm text-muted">
            {BRAND_HOURS.map((item) => (
              <p key={item}>{item}</p>
            ))}
          </div>
        </SurfaceCard>
        {(() => {
          const waHref = createWhatsAppLink({
            phone: BRAND_WHATSAPP_NUMBER,
            message: 'Merhaba TicketGo Teknoloji, hizmetleriniz hakkında bilgi almak istiyorum.',
          });
          return waHref ? (
            <SurfaceCard>
              <WhatsAppIcon size={20} />
              <h2 className="mt-4 text-sm font-semibold text-ink">WhatsApp</h2>
              <p className="mt-2 text-sm text-muted">Hızlı iletişim için WhatsApp üzerinden yazabilirsiniz.</p>
              <a
                href={waHref}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-brand-600 hover:text-brand-700"
              >
                <WhatsAppIcon size={14} />
                WhatsApp&apos;tan Yaz
              </a>
            </SurfaceCard>
          ) : null;
        })()}
      </div>

      <div className="mt-12 grid min-w-0 gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <div className="min-w-0">
          <ContactForm />
        </div>
        <aside className="surface-card min-w-0 overflow-hidden bg-brand-50/40 p-6 sm:p-7">
          <h2 className="text-lg font-semibold text-ink">Kurumsal kanallar</h2>
          <div className="mt-5 space-y-3 text-sm text-muted">
            {BRAND_CONTACT_CHANNELS.map((channel) => (
              <div key={channel.email}>
                <p>{channel.label}</p>
                <a href={`mailto:${channel.email}`} className="email-link mt-1 block font-semibold text-brand-600">
                  {channel.email}
                </a>
              </div>
            ))}
            <p>Bu form, proje ve iş birliği taleplerinizi ekibimize iletmek için kullanılır.</p>
          </div>
        </aside>
      </div>
    </main>
  );
}
