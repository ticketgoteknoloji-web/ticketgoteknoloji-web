'use client';

import {
  Briefcase,
  Building2,
  Headphones,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  X,
} from 'lucide-react';
import { createWhatsAppLink } from '@/lib/mailto';
import { WhatsAppIcon } from '@/components/WhatsAppButton';
import Link from 'next/link';
import { useEffect, useId, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { COMPANY, displayRegistry } from '@/config/company';
import { acquireScrollLock } from '@/lib/scroll-lock';

type ContactModalProps = {
  open: boolean;
  onClose: () => void;
  returnFocusRef?: RefObject<HTMLElement | null>;
};

const contactChannels = [
  { label: 'Genel İletişim', email: COMPANY.emails.info, Icon: Mail },
  { label: 'Yönetim', email: COMPANY.emails.admin, Icon: Briefcase },
  { label: 'Teknik Destek', email: COMPANY.emails.support, Icon: Headphones },
  { label: 'KVKK', email: COMPANY.emails.kvkk, Icon: ShieldCheck },
] as const;

export function ContactModal({ open, onClose, returnFocusRef }: ContactModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const [mounted, setMounted] = useState(false);
  const phone = COMPANY.phone.value.trim();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const release = acquireScrollLock();
    const opener = returnFocusRef?.current ?? null;
    const panel = panelRef.current;
    const getFocusables = () =>
      panel?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
      );

    window.setTimeout(() => getFocusables()?.[0]?.focus(), 20);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusables = getFocusables();
      if (!focusables || focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      release();
      document.removeEventListener('keydown', onKeyDown);
      opener?.focus();
    };
  }, [open, onClose, returnFocusRef]);

  if (!mounted || !open) return null;

  return createPortal(
    <div className="site-modal-overlay contact-modal-overlay" onMouseDown={onClose}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="site-modal-panel contact-modal-panel w-[94vw] max-w-[980px]"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start gap-3 border-b border-line px-5 py-4 sm:px-7">
          <span className="mt-0.5 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-brand-200 bg-brand-50 text-brand-600">
            <Building2 size={20} aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">
              İletişim
            </h2>
            <p id={descriptionId} className="mt-1 text-sm leading-6 text-muted">
              Projeleriniz, teknoloji ihtiyaçlarınız ve iş birliği talepleriniz için TicketGo Teknoloji A.Ş. ile
              iletişime geçebilirsiniz.
            </p>
          </div>
          <button
            type="button"
            aria-label="İletişim penceresini kapat"
            onClick={onClose}
            className="btn btn-ghost min-h-11 min-w-11 rounded-full p-2"
          >
            <X size={18} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-5 py-5 sm:px-7 sm:py-6">
          <div className="grid gap-8 md:grid-cols-2">
            <section>
              <h3 className="text-base font-semibold text-ink">Bize Ulaşın</h3>
              <ul className="mt-4 space-y-4">
                {contactChannels.map(({ label, email, Icon }) => (
                  <li key={email} className="flex gap-3">
                    <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line bg-canvas text-brand-600">
                      <Icon size={16} aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink">{label}</p>
                      <a
                        href={`mailto:${email}`}
                        className="email-link mt-1 block break-all text-sm font-semibold text-brand-600 hover:underline"
                      >
                        {email}
                      </a>
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            <section>
              <h3 className="text-base font-semibold text-ink">Kurumsal Bilgiler</h3>
              <dl className="mt-4 space-y-4 text-sm">
                <div className="flex gap-3">
                  <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line bg-canvas text-brand-600">
                    <Building2 size={16} aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <dt className="font-medium text-ink">Şirket Unvanı</dt>
                    <dd className="mt-1 text-muted">{COMPANY.legalName}</dd>
                  </div>
                </div>
                <div className="flex gap-3">
                  <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line bg-canvas text-brand-600">
                    <Building2 size={16} aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <dt className="font-medium text-ink">Vergi Dairesi</dt>
                    <dd className="mt-1 text-muted">{displayRegistry(COMPANY.taxOffice)}</dd>
                  </div>
                </div>
                <div className="flex gap-3">
                  <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line bg-canvas text-brand-600">
                    <Building2 size={16} aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <dt className="font-medium text-ink">Vergi No</dt>
                    <dd className="mt-1 text-muted">{displayRegistry(COMPANY.taxNumber)}</dd>
                  </div>
                </div>
                <div className="flex gap-3">
                  <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line bg-canvas text-brand-600">
                    <Building2 size={16} aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <dt className="font-medium text-ink">MERSİS</dt>
                    <dd className="mt-1 break-all text-muted">{displayRegistry(COMPANY.mersis)}</dd>
                  </div>
                </div>
                <div className="flex gap-3">
                  <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line bg-canvas text-brand-600">
                    <MapPin size={16} aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <dt className="font-medium text-ink">Adres</dt>
                    <dd className="mt-1 leading-6 text-muted">{displayRegistry(COMPANY.address)}</dd>
                  </div>
                </div>
                {phone ? (
                  <div className="flex gap-3">
                    <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line bg-canvas text-brand-600">
                      <Phone size={16} aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <dt className="font-medium text-ink">Telefon</dt>
                      <dd className="mt-1">
                        <a href={COMPANY.phoneHref} className="font-semibold text-brand-600 hover:underline">
                          {phone}
                        </a>
                      </dd>
                    </div>
                  </div>
                ) : null}
              </dl>
            </section>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-line px-5 py-4 sm:px-7">
          <a href={`mailto:${COMPANY.emails.info}`} className="btn btn-secondary gap-2">
            <Mail size={14} aria-hidden="true" />
            E-posta Gönder
          </a>
          {(() => {
            const waHref = createWhatsAppLink({
              phone: COMPANY.whatsapp,
              message: 'Merhaba TicketGo Teknoloji, hizmetleriniz hakkında bilgi almak istiyorum.',
            });
            return waHref ? (
              <a
                href={waHref}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-secondary gap-2"
              >
                <WhatsAppIcon size={14} />
                WhatsApp&apos;tan Yaz
              </a>
            ) : null;
          })()}
          <Link href="/contact" className="btn btn-primary sm:ml-auto" onClick={onClose}>
            Mesaj Gönder
          </Link>
        </div>
      </div>
    </div>,
    document.body
  );
}
