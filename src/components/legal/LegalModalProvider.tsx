'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { LegalModal, type LegalDocumentId } from '@/components/legal/LegalModal';

type LegalModalContextValue = {
  isOpen: boolean;
  openLegalModal: (doc: LegalDocumentId, opener?: HTMLElement | null) => void;
  closeLegalModal: () => void;
};

const LegalModalContext = createContext<LegalModalContextValue | null>(null);

export function LegalModalProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [activeDoc, setActiveDoc] = useState<LegalDocumentId>('kvkk');
  const openerRef = useRef<HTMLElement | null>(null);

  const openLegalModal = useCallback((doc: LegalDocumentId, opener?: HTMLElement | null) => {
    openerRef.current = opener ?? (document.activeElement as HTMLElement | null);
    setActiveDoc(doc);
    setOpen(true);
  }, []);

  const closeLegalModal = useCallback(() => setOpen(false), []);

  const value = useMemo(
    () => ({ isOpen: open, openLegalModal, closeLegalModal }),
    [open, openLegalModal, closeLegalModal],
  );

  return (
    <LegalModalContext.Provider value={value}>
      {children}
      <LegalModal
        open={open}
        docId={activeDoc}
        onClose={closeLegalModal}
        returnFocusRef={openerRef}
      />
    </LegalModalContext.Provider>
  );
}

export function useLegalModal(): LegalModalContextValue {
  const ctx = useContext(LegalModalContext);
  if (!ctx) throw new Error('useLegalModal must be used within LegalModalProvider');
  return ctx;
}
