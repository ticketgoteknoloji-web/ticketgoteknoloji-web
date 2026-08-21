'use client';

import { useCallback, useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { COMPANY } from '@/config/company';
import { acquireScrollLock } from '@/lib/scroll-lock';
import { KvkkContent } from '@/components/legal/KvkkContent';
import { PrivacyContent } from '@/components/legal/PrivacyContent';
import { CookiesContent } from '@/components/legal/CookiesContent';
import { DistanceSalesContent } from '@/components/legal/DistanceSalesContent';
import { PreInfoContent } from '@/components/legal/PreInfoContent';
import { RefundContent } from '@/components/legal/RefundContent';

export type LegalDocumentId =
  | 'kvkk'
  | 'privacy'
  | 'cookies'
  | 'distance-sales'
  | 'pre-information'
  | 'refund';

const DOC_TITLES: Record<LegalDocumentId, string> = {
  kvkk: 'KVKK Aydınlatma Metni',
  privacy: 'Gizlilik ve Kişisel Verilerin Korunması Politikası',
  cookies: 'Çerez Politikası',
  'distance-sales': 'Mesafeli Satış Sözleşmesi',
  'pre-information': 'Mesafeli Satış Ön Bilgilendirme Formu',
  refund: 'İptal, Cayma ve İade Koşulları',
};

function DocContent({ docId }: { docId: LegalDocumentId }) {
  switch (docId) {
    case 'kvkk':
      return <KvkkContent omitChrome />;
    case 'privacy':
      return <PrivacyContent omitChrome />;
    case 'cookies':
      return <CookiesContent omitChrome />;
    case 'distance-sales':
      return <DistanceSalesContent omitChrome />;
    case 'pre-information':
      return <PreInfoContent omitChrome />;
    case 'refund':
      return <RefundContent omitChrome />;
  }
}

type LegalModalProps = {
  open: boolean;
  docId: LegalDocumentId;
  onClose: () => void;
  returnFocusRef?: React.MutableRefObject<HTMLElement | null>;
};

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

export function LegalModal({ open, docId, onClose, returnFocusRef }: LegalModalProps) {
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    return acquireScrollLock();
  }, [open]);

  useEffect(() => {
    if (open) {
      const t = window.setTimeout(() => closeBtnRef.current?.focus(), 60);
      return () => window.clearTimeout(t);
    }
    returnFocusRef?.current?.focus();
  }, [open, returnFocusRef]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !panelRef.current) return;
      const nodes = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => !el.hasAttribute('disabled') && el.tabIndex !== -1
      );
      if (!nodes.length) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const handleOverlay = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose]
  );

  if (!open) return null;
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="legal-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={handleOverlay}
    >
      <div ref={panelRef} className="legal-modal-panel">
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-line bg-white px-5 py-4 sm:px-8 sm:py-5">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-widest text-brand-600">{COMPANY.legalName}</p>
            <h2 id={titleId} className="mt-1 text-base font-semibold tracking-tight text-ink sm:text-lg">
              {DOC_TITLES[docId]}
            </h2>
          </div>
          <button
            ref={closeBtnRef}
            type="button"
            aria-label="Kapat"
            onClick={onClose}
            className="btn btn-ghost h-10 w-10 shrink-0 rounded-lg p-0"
          >
            <X size={18} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:px-8 sm:py-8">
          <DocContent docId={docId} />
        </div>
      </div>
    </div>,
    document.body
  );
}
