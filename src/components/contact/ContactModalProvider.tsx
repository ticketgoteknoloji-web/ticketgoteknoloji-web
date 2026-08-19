'use client';

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { ContactModal } from '@/components/contact/ContactModal';

type ContactModalContextValue = {
  isOpen: boolean;
  openContactModal: (opener?: HTMLElement | null) => void;
  closeContactModal: () => void;
};

const ContactModalContext = createContext<ContactModalContextValue | null>(null);

export function ContactModalProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const openerRef = useRef<HTMLElement | null>(null);

  const openContactModal = useCallback((opener?: HTMLElement | null) => {
    openerRef.current = opener ?? (document.activeElement as HTMLElement | null);
    setOpen(true);
  }, []);

  const closeContactModal = useCallback(() => {
    setOpen(false);
  }, []);

  const value = useMemo(
    () => ({
      isOpen: open,
      openContactModal,
      closeContactModal,
    }),
    [open, openContactModal, closeContactModal]
  );

  return (
    <ContactModalContext.Provider value={value}>
      {children}
      <ContactModal open={open} onClose={closeContactModal} returnFocusRef={openerRef} />
    </ContactModalContext.Provider>
  );
}

export function useContactModal(): ContactModalContextValue {
  const context = useContext(ContactModalContext);
  if (!context) {
    throw new Error('useContactModal must be used within ContactModalProvider');
  }
  return context;
}
