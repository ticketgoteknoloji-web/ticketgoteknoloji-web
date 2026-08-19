import { ContactForm } from '@/components/ContactForm';
import {
  BRAND_ADDRESS,
  BRAND_CONTACT_CHANNELS,
  BRAND_HOURS,
  BRAND_PHONE_DISPLAY,
  BRAND_PHONE_HREF,
} from '@/lib/site';

export function ContactSection() {
  return (
    <section id="iletisim" className="section-wrap section-y scroll-section">
      <h2 className="section-title">İletişim</h2>
      <p className="section-subtitle">
        Özel yazılım, CRM, SaaS veya entegrasyon ihtiyacınız için ekibimizle iletişime geçin.
      </p>
      <div className="mt-10 grid min-w-0 gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <div className="min-w-0">
          <ContactForm />
        </div>
        <aside className="surface-card min-w-0 overflow-hidden p-6 sm:p-7">
          <h3 className="text-lg font-semibold text-ink">İletişim Kanalları</h3>
          <div className="mt-5 space-y-4 text-sm">
            <div>
              <p className="text-muted">Telefon</p>
              <a href={BRAND_PHONE_HREF} className="mt-1 inline-block font-semibold text-brand-600 underline">
                {BRAND_PHONE_DISPLAY}
              </a>
            </div>
            {BRAND_CONTACT_CHANNELS.map((channel) => (
              <div key={channel.email}>
                <p className="text-muted">{channel.label}</p>
                <a
                  href={`mailto:${channel.email}`}
                  className="email-link mt-1 block font-semibold text-brand-600 underline"
                >
                  {channel.email}
                </a>
              </div>
            ))}
            <p className="text-muted">{BRAND_ADDRESS}</p>
            {BRAND_HOURS.map((item) => (
              <p key={item} className="text-muted">
                {item}
              </p>
            ))}
          </div>
        </aside>
      </div>
    </section>
  );
}
