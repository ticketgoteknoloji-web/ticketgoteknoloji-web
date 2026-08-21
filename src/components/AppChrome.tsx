'use client';

import { usePathname } from 'next/navigation';
import { BackToTop } from '@/components/BackToTop';
import { ContactModalProvider } from '@/components/contact/ContactModalProvider';
import { LegalModalProvider } from '@/components/legal/LegalModalProvider';
import { Navbar } from '@/components/Navbar';
import { PublicFooter } from '@/components/PublicFooter';

export function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const checkout = pathname.startsWith('/payment');

  return (
    <LegalModalProvider>
      <ContactModalProvider>
        <div className="relative z-[1]">
          {checkout ? null : (
            <div className="print:hidden">
              <Navbar />
            </div>
          )}
          {checkout ? <div className="payment-shell">{children}</div> : children}
          {checkout ? null : (
            <div className="print:hidden">
              <PublicFooter />
            </div>
          )}
          {checkout ? null : (
            <div className="print:hidden">
              <BackToTop />
            </div>
          )}
        </div>
      </ContactModalProvider>
    </LegalModalProvider>
  );
}
