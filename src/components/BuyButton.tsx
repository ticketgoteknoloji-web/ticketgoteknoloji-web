'use client';

import Link from 'next/link';
import { useState } from 'react';

type BuyButtonProps = {
  href: string;
  className?: string;
  children: React.ReactNode;
};

export function BuyButton({ href, className, children }: BuyButtonProps) {
  const [pending, setPending] = useState(false);

  return (
    <Link
      href={href}
      className={`${className ?? ''} ${pending ? 'pointer-events-none' : ''}`}
      aria-disabled={pending}
      onClick={(event) => {
        if (pending) {
          event.preventDefault();
          return;
        }
        setPending(true);
      }}
    >
      {pending ? 'Ödeme Sayfasına Yönlendiriliyor...' : children}
    </Link>
  );
}
