'use client';

import Link from 'next/link';
import { useEffect } from 'react';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="section-wrap flex min-h-[60vh] flex-col items-center justify-center py-16 text-center">
      <h1 className="text-3xl font-semibold tracking-tight text-ink">Bir sorun oluştu</h1>
      <p className="mt-4 max-w-xl text-sm text-muted">
        Sayfa yüklenirken beklenmeyen bir hata oluştu. Lütfen tekrar deneyin veya ana sayfaya dönün.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <button type="button" onClick={reset} className="btn btn-primary rounded-full">
          Tekrar dene
        </button>
        <Link href="/" className="btn btn-secondary rounded-full">
          Ana Sayfaya Dön
        </Link>
      </div>
    </main>
  );
}
