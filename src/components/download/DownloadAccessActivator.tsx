'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

type ClaimState = 'claiming' | 'ready' | 'error' | 'not_download';

/**
 * After verified paid checkout, claim HttpOnly download access cookie.
 * Token is the server-known order statusToken; claim API re-validates paid status.
 * Never trusts client-side "paid" flags.
 */
export function DownloadAccessActivator({ orderId, token }: { orderId: string; token: string }) {
  const [state, setState] = useState<ClaimState>('claiming');
  const [message, setMessage] = useState('Ödemeniz onaylandı, indirme yetkiniz hazırlanıyor...');
  const [productId, setProductId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function claim() {
      setState('claiming');
      setMessage('Ödemeniz onaylandı, indirme yetkiniz hazırlanıyor...');
      try {
        const res = await fetch('/api/downloads/claim', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId, token }),
          signal: controller.signal,
        });
        const json = (await res.json()) as {
          error?: string;
          ok?: boolean;
          downloadProduct?: boolean;
          canDownload?: boolean;
          productId?: string;
        };
        if (cancelled) return;
        if (!res.ok) {
          setState('error');
          setMessage(json.error || 'İndirme yetkisi oluşturulamadı. Lütfen Download Center üzerinden tekrar deneyin.');
          return;
        }
        if (json.downloadProduct && json.canDownload !== false) {
          setProductId(json.productId ?? null);
          setState('ready');
          setMessage('İndirme hakkınız aktif.');
          return;
        }
        setState('not_download');
        setMessage('Ödemeniz alındı. Bu ürün Download Center paketi değil.');
      } catch (error) {
        if (cancelled) return;
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setState('error');
        setMessage('İndirme yetkisi oluşturulamadı. Lütfen Download Center üzerinden tekrar deneyin.');
      }
    }

    void claim();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [orderId, token]);

  const tone =
    state === 'ready'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
      : state === 'error'
        ? 'border-red-200 bg-red-50 text-red-900'
        : 'border-sky-200 bg-sky-50 text-sky-900';

  return (
    <div className={`mt-6 rounded-2xl border px-4 py-4 text-sm ${tone}`} role="status" aria-live="polite">
      <p className="font-semibold">{message}</p>
      {state === 'claiming' ? (
        <p className="mt-1 text-xs opacity-80">Yetki kontrolü sunucu tarafında doğrulanıyor…</p>
      ) : null}
      {state === 'ready' ? (
        <div className="mt-4">
          <Link
            href={productId ? `/download#${encodeURIComponent(productId)}` : '/download'}
            className="btn btn-primary inline-flex rounded-full px-6 py-3"
          >
            Download Center&apos;a Git
          </Link>
        </div>
      ) : null}
      {state === 'error' ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/download" className="btn btn-secondary inline-flex rounded-full px-5 py-2.5">
            Download Center
          </Link>
          <Link href="/contact?need=İndirme%20Yetkisi" className="btn btn-ghost inline-flex rounded-full px-5 py-2.5">
            Destek
          </Link>
        </div>
      ) : null}
    </div>
  );
}
