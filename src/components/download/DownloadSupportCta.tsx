'use client';

import { useContactModal } from '@/components/contact/ContactModalProvider';
import { BRAND_SUPPORT_EMAIL } from '@/lib/site';

export function DownloadSupportCta() {
  const { openContactModal } = useContactModal();

  return (
    <section className="section-accent">
      <div className="section-wrap section-y">
        <div className="relative overflow-hidden rounded-2xl border border-line bg-surface px-8 py-10 shadow-soft md:flex md:items-center md:justify-between md:px-12 md:py-14">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(640px_240px_at_0%_0%,rgba(59,130,246,0.08),transparent_62%)]" />
          <div className="relative max-w-2xl">
            <h2 className="section-title">Kurulum konusunda yardıma mı ihtiyacınız var?</h2>
            <p className="mt-4 text-base leading-7 text-muted">
              Kurulum, paket doğrulama veya sürüm seçimi hakkında sorularınız için TicketGo Teknoloji
              teknik destek ekibiyle iletişime geçin.
            </p>
            <p className="mt-3 text-sm text-muted">
              Destek:{' '}
              <a
                href={`mailto:${BRAND_SUPPORT_EMAIL}`}
                className="email-link font-medium text-brand-600 hover:underline"
              >
                {BRAND_SUPPORT_EMAIL}
              </a>
            </p>
          </div>
          <button
            type="button"
            className="btn btn-primary relative mt-6 shrink-0 md:mt-0"
            onClick={(event) => openContactModal(event.currentTarget)}
          >
            Teknik Destek
          </button>
        </div>
      </div>
    </section>
  );
}
