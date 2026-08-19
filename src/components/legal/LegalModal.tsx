'use client';

import { useCallback, useEffect, useRef } from 'react';
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
    case 'kvkk':           return <KvkkContent />;
    case 'privacy':        return <PrivacyContent />;
    case 'cookies':        return <CookiesContent />;
    case 'distance-sales': return <DistanceSalesContent />;
    case 'pre-information': return <PreInfoContent />;
    case 'refund':         return <RefundContent />;
  }
}

type LegalModalProps = {
  open: boolean;
  docId: LegalDocumentId;
  onClose: () => void;
  returnFocusRef?: React.MutableRefObject<HTMLElement | null>;
};

export function LegalModal({ open, docId, onClose, returnFocusRef }: LegalModalProps) {
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const titleId = 'legal-modal-title';

  /* Scroll lock */
  useEffect(() => {
    if (!open) return;
    const release = acquireScrollLock();
    return release;
  }, [open]);

  /* Focus management */
  useEffect(() => {
    if (open) {
      setTimeout(() => closeBtnRef.current?.focus(), 60);
    } else {
      returnFocusRef?.current?.focus();
    }
  }, [open, returnFocusRef]);

  /* ESC to close */
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const handleOverlay = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose],
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
      <div className="legal-modal-panel">
        {/* ── Sticky header ── */}
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-line bg-white px-6 py-5 sm:px-8">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-widest text-brand-600">
              {COMPANY.legalName}
            </p>
            <h2
              id={titleId}
              className="mt-1 text-base font-semibold tracking-tight text-ink sm:text-lg"
            >
              {DOC_TITLES[docId]}
            </h2>
          </div>
          <button
            ref={closeBtnRef}
            type="button"
            aria-label="Kapat"
            onClick={onClose}
            className="btn btn-ghost h-9 w-9 shrink-0 rounded-lg p-0"
          >
            <X size={18} />
          </button>
        </div>

        {/* ── Scrollable body ── */}
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6 sm:px-8 sm:py-8">
          <DocContent docId={docId} />
        </div>
      </div>
    </div>,
    document.body,
  );
}
