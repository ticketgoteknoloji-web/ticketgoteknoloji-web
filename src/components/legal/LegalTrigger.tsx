'use client';

import { useRef } from 'react';
import { useLegalModal } from '@/components/legal/LegalModalProvider';
import type { LegalDocumentId } from '@/components/legal/LegalModal';

type LegalTriggerProps = {
  doc: LegalDocumentId;
  className?: string;
  children: React.ReactNode;
};

/**
 * LegalTrigger — opens the unified LegalModal for the given document.
 * Direct URL navigation (/kvkk, /privacy, etc.) still works via page routes.
 */
export function LegalTrigger({ doc, className = '', children }: LegalTriggerProps) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const { openLegalModal } = useLegalModal();

  return (
    <button
      ref={btnRef}
      type="button"
      className={className}
      onClick={() => openLegalModal(doc, btnRef.current)}
    >
      {children}
    </button>
  );
}
