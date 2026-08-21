'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Download, Search, Upload, X } from 'lucide-react';
import { BuyButton } from '@/components/BuyButton';
import {
  DOWNLOAD_PAGE_SIZE,
  DOWNLOAD_PLATFORM_IDS,
  DOWNLOAD_PLATFORM_LABELS,
  DOWNLOAD_TABLE_FILTERS,
  formatShortDate,
  matchesPlatformFilter,
  type DownloadPlatformFilter,
  type DownloadPlatformId,
} from '@/data/downloads';
import type { PublicDownloadPackage } from '@/lib/downloads/types';
import { acquireScrollLock } from '@/lib/scroll-lock';
import { BRAND_LEGAL_NAME } from '@/lib/site';
import { formatMoney } from '@/lib/money';

type AccessInfo = {
  state: string;
  canDownload: boolean;
  label?: string;
  paymentUrl?: string;
};

function PlatformBadges({ platforms }: { platforms: readonly DownloadPlatformId[] }) {
  if (!platforms.length) {
    return <span className="text-sm text-muted">—</span>;
  }
  return (
    <ul
      className="flex flex-wrap gap-1.5"
      aria-label={platforms.map((id) => DOWNLOAD_PLATFORM_LABELS[id]).join(' · ')}
    >
      {platforms.map((id) => (
        <li key={id}>
          <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold tracking-wide text-slate-700">
            {DOWNLOAD_PLATFORM_LABELS[id]}
          </span>
        </li>
      ))}
    </ul>
  );
}

function EmptyDownloadState({ onUpload }: { onUpload: () => void }) {
  return (
    <div
      className="rounded-2xl border border-dashed border-line bg-white px-6 py-14 text-center shadow-soft"
      role="status"
    >
      <p className="text-base font-semibold text-ink">Henüz yayınlanmış bir yazılım paketi bulunmuyor.</p>
      <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-muted">
        Yeni yazılım paketleri yayınlandığında bu alanda listelenecektir.
      </p>
      <button type="button" className="btn btn-secondary mt-6 min-h-11 gap-2" onClick={onUpload}>
        <Upload size={16} aria-hidden />
        Yazılım Yükle
      </button>
    </div>
  );
}

function AdminLoginModal({
  open,
  onClose,
  onSuccess,
  returnFocusRef,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  returnFocusRef: React.MutableRefObject<HTMLElement | null>;
}) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!open) return;
    return acquireScrollLock();
  }, [open]);

  useEffect(() => {
    if (open) {
      const t = window.setTimeout(() => closeRef.current?.focus(), 60);
      return () => window.clearTimeout(t);
    }
    returnFocusRef.current?.focus();
  }, [open, returnFocusRef]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="site-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="site-modal-panel max-w-md">
        <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-brand-600">{BRAND_LEGAL_NAME}</p>
            <h2 id={titleId} className="mt-1 text-base font-semibold text-ink">
              Admin Girişi
            </h2>
          </div>
          <button ref={closeRef} type="button" aria-label="Kapat" className="btn btn-ghost h-9 w-9 p-0" onClick={onClose}>
            <X size={18} aria-hidden />
          </button>
        </div>
        <form
          className="space-y-4 px-6 py-5"
          onSubmit={async (event) => {
            event.preventDefault();
            setPending(true);
            setError(null);
            try {
              const res = await fetch('/api/downloads/admin/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
              });
              const data = (await res.json()) as { error?: string };
              if (!res.ok) {
                setError(data.error || 'Kullanıcı adı veya şifre hatalı.');
                return;
              }
              setPassword('');
              onSuccess();
            } catch {
              setError('Giriş yapılamadı. Lütfen tekrar deneyin.');
            } finally {
              setPending(false);
            }
          }}
        >
          <label className="block text-sm">
            <span className="font-medium text-ink">Kullanıcı adı</span>
            <input
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1.5 h-11 w-full rounded-xl border border-line px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-ink">Şifre</span>
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1.5 h-11 w-full rounded-xl border border-line px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
            />
          </label>
          {error ? <p className="text-sm text-red-700">{error}</p> : null}
          <div className="flex flex-wrap gap-2 pt-1">
            <button type="submit" className="btn btn-primary min-h-11" disabled={pending}>
              {pending ? 'Doğrulanıyor…' : 'Giriş / Devam'}
            </button>
            <button type="button" className="btn btn-secondary min-h-11" onClick={onClose}>
              Vazgeç
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

function AdminUploadModal({
  open,
  onClose,
  onUploaded,
  returnFocusRef,
}: {
  open: boolean;
  onClose: () => void;
  onUploaded: () => void;
  returnFocusRef: React.MutableRefObject<HTMLElement | null>;
}) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    return acquireScrollLock();
  }, [open]);

  useEffect(() => {
    if (open) {
      const t = window.setTimeout(() => closeRef.current?.focus(), 60);
      return () => window.clearTimeout(t);
    }
    returnFocusRef.current?.focus();
  }, [open, returnFocusRef]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="site-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="site-modal-panel max-w-lg">
        <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-brand-600">{BRAND_LEGAL_NAME}</p>
            <h2 id={titleId} className="mt-1 text-base font-semibold text-ink">
              Yazılım Paketi Yükle
            </h2>
          </div>
          <button ref={closeRef} type="button" aria-label="Kapat" className="btn btn-ghost h-9 w-9 p-0" onClick={onClose}>
            <X size={18} aria-hidden />
          </button>
        </div>
        <form
          className="space-y-3 px-6 py-5"
          onSubmit={async (event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const data = new FormData(form);
            setPending(true);
            setError(null);
            try {
              const res = await fetch('/api/downloads/admin/upload', { method: 'POST', body: data });
              const json = (await res.json()) as { error?: string };
              if (!res.ok) {
                setError(json.error || 'Yükleme başarısız.');
                return;
              }
              form.reset();
              onUploaded();
              onClose();
            } catch {
              setError('Yükleme başarısız.');
            } finally {
              setPending(false);
            }
          }}
        >
          <label className="block text-sm">
            <span className="font-medium text-ink">Yazılım adı</span>
            <input name="name" required maxLength={120} className="mt-1.5 h-11 w-full rounded-xl border border-line px-3 text-sm" />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-ink">Kısa açıklama</span>
            <textarea name="description" required maxLength={500} rows={3} className="mt-1.5 w-full rounded-xl border border-line px-3 py-2 text-sm" />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <fieldset className="block text-sm sm:col-span-2">
              <legend className="font-medium text-ink">Platform</legend>
              <p className="mt-1 text-xs text-muted">Birden fazla seçilebilir; aynı dosya tek kayıt olarak kalır.</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {DOWNLOAD_PLATFORM_IDS.map((id) => (
                  <label
                    key={id}
                    className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-line bg-slate-50 px-3 py-2 text-sm font-medium text-ink"
                  >
                    <input type="checkbox" name="platforms" value={id} className="h-4 w-4 rounded border-line text-brand-600" />
                    {DOWNLOAD_PLATFORM_LABELS[id]}
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="block text-sm">
              <span className="font-medium text-ink">Sürüm</span>
              <input name="version" required maxLength={40} placeholder="v1.0.0" className="mt-1.5 h-11 w-full rounded-xl border border-line px-3 text-sm" />
            </label>
            <label className="block text-sm">
              <span className="font-medium text-ink">Mimari</span>
              <input name="architecture" defaultValue="Universal" maxLength={40} className="mt-1.5 h-11 w-full rounded-xl border border-line px-3 text-sm" />
            </label>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="font-medium text-ink">Fiyat (USD)</span>
              <input name="priceUsd" type="number" min={0} step="0.01" placeholder="Boş = satışa kapalı" className="mt-1.5 h-11 w-full rounded-xl border border-line px-3 text-sm" />
            </label>
          </div>
          <label className="block text-sm">
            <span className="font-medium text-ink">Dosya</span>
            <input
              name="file"
              type="file"
              required
              accept=".txt,.zip,.dmg,.pkg,.exe,.msi,.apk"
              className="mt-1.5 block w-full text-sm"
            />
          </label>
          {error ? <p className="text-sm text-red-700">{error}</p> : null}
          <div className="flex flex-wrap gap-2 pt-1">
            <button type="submit" className="btn btn-primary min-h-11" disabled={pending}>
              {pending ? 'Kaydediliyor…' : 'Kaydet'}
            </button>
            <button type="button" className="btn btn-secondary min-h-11" onClick={onClose}>
              Vazgeç
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

function paymentBadge(state: string | undefined) {
  if (state === 'download_ready') {
    return <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800">Ödendi</span>;
  }
  if (state === 'payment_pending') {
    return <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-900">Bekliyor</span>;
  }
  if (state === 'no_file') {
    return <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700">Dosya yok</span>;
  }
  if (state === 'price_undefined') {
    return <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700">Fiyat yok</span>;
  }
  return <span className="inline-flex rounded-full border border-sky-200 bg-sky-50 px-2.5 py-0.5 text-[11px] font-semibold text-sky-800">Satın alınabilir</span>;
}

export function DownloadTable() {
  const [packages, setPackages] = useState<PublicDownloadPackage[]>([]);
  const [accessMap, setAccessMap] = useState<Record<string, AccessInfo>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [platform, setPlatform] = useState<DownloadPlatformFilter>('all');
  const [adminOpen, setAdminOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [adminAuthed, setAdminAuthed] = useState(false);
  const triggerRef = useRef<HTMLElement | null>(null);
  const searchId = useId();

  const refresh = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 20_000);
    try {
      const [listRes, sessionRes] = await Promise.all([
        fetch('/api/downloads', { cache: 'no-store', signal: controller.signal }),
        fetch('/api/downloads/admin/session', { cache: 'no-store', signal: controller.signal }),
      ]);
      if (!listRes.ok) {
        throw new Error('Paket listesi alınamadı.');
      }
      const listJson = (await listRes.json()) as { packages?: PublicDownloadPackage[] };
      const sessionJson = (await sessionRes.json()) as { authenticated?: boolean };
      const rows = Array.isArray(listJson.packages) ? listJson.packages : [];
      setPackages(rows);
      setAdminAuthed(Boolean(sessionJson.authenticated));

      const accessEntries = await Promise.all(
        rows.map(async (pkg) => {
          try {
            const res = await fetch(`/api/downloads/${encodeURIComponent(pkg.productId)}/access`, {
              cache: 'no-store',
              signal: controller.signal,
            });
            const info = (await res.json()) as AccessInfo;
            return [pkg.productId, info] as const;
          } catch {
            return [pkg.productId, { state: 'purchase_required', canDownload: false } as AccessInfo] as const;
          }
        })
      );
      setAccessMap(Object.fromEntries(accessEntries));
    } catch (error) {
      setPackages([]);
      setAccessMap({});
      setLoadError(
        error instanceof DOMException && error.name === 'AbortError'
          ? 'Paketler zaman aşımına uğradı. Lütfen yeniden deneyin.'
          : 'Paketler yüklenemedi. Lütfen yeniden deneyin.'
      );
    } finally {
      window.clearTimeout(timeout);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('tr-TR');
    return packages.filter((pkg) => {
      if (!matchesPlatformFilter(pkg.platforms ?? pkg.platform, platform)) return false;
      if (!q) return true;
      const platformHay = (pkg.platforms ?? [])
        .map((id) => DOWNLOAD_PLATFORM_LABELS[id])
        .concat(pkg.platform ? [pkg.platform] : [])
        .join(' ');
      const hay = [pkg.name, pkg.description, platformHay, pkg.version].join(' ').toLocaleLowerCase('tr-TR');
      return hay.includes(q);
    });
  }, [packages, query, platform]);

  const beginUpload = async (opener: HTMLElement | null) => {
    triggerRef.current = opener;
    if (adminAuthed) {
      setUploadOpen(true);
      return;
    }
    const session = await fetch('/api/downloads/admin/session', { cache: 'no-store' });
    const json = (await session.json()) as { authenticated?: boolean };
    if (json.authenticated) {
      setAdminAuthed(true);
      setUploadOpen(true);
      return;
    }
    setAdminOpen(true);
  };

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-3xl">
          <h2 id="software-packages-table" className="section-title text-[1.5rem] sm:text-[1.75rem]">
            Yazılım Paketleri
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted sm:text-base sm:leading-7">
            TicketGo Teknoloji A.Ş. tarafından yayınlanan masaüstü, mobil ve yardımcı yazılım
            paketlerinin güncel sürümlerine buradan erişebilirsiniz.
          </p>
          <p className="mt-2 text-xs text-muted">Sayfa başına en fazla {DOWNLOAD_PAGE_SIZE} gerçek kayıt listelenir.</p>
        </div>
        <button
          type="button"
          className="btn btn-secondary min-h-11 shrink-0 gap-2"
          onClick={(e) => void beginUpload(e.currentTarget)}
        >
          <Upload size={16} aria-hidden />
          Yükle
        </button>
      </div>

      {loading ? (
        <p className="mt-8 text-sm text-muted">Paketler yükleniyor…</p>
      ) : loadError ? (
        <div className="mt-8 rounded-2xl border border-line bg-white px-6 py-10 text-center shadow-soft" role="alert">
          <p className="text-sm font-medium text-ink">{loadError}</p>
          <button type="button" className="btn btn-secondary mt-4 min-h-11" onClick={() => void refresh()}>
            Yeniden dene
          </button>
        </div>
      ) : packages.length === 0 ? (
        <div className="mt-8">
          <EmptyDownloadState onUpload={() => void beginUpload(null)} />
        </div>
      ) : (
        <>
          <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <label htmlFor={searchId} className="relative block min-w-0 flex-1 lg:max-w-sm">
              <span className="sr-only">Yazılım ara</span>
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
              <input
                id={searchId}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Yazılım ara..."
                className="h-11 w-full rounded-xl border border-line bg-white py-2 pl-10 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
              />
            </label>
            <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0" role="group" aria-label="Platform filtresi">
              <div className="inline-flex min-w-max gap-1.5 rounded-xl border border-line bg-white p-1.5 shadow-soft">
                {DOWNLOAD_TABLE_FILTERS.map((option) => {
                  const active = platform === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      aria-pressed={active}
                      className={`min-h-10 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold ${
                        active ? 'bg-brand-600 text-white' : 'text-ink hover:bg-[var(--bg-accent)]'
                      }`}
                      onClick={() => setPlatform(option.id)}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Desktop table */}
          <div className="mt-5 hidden overflow-hidden rounded-2xl border border-line bg-white shadow-soft lg:block">
            <div className="overflow-x-auto">
              <table className="min-w-[1180px] w-full border-collapse text-left text-sm" aria-labelledby="software-packages-table">
                <thead className="bg-[var(--bg-accent)]">
                  <tr className="border-b border-line text-[0.8125rem] font-semibold tracking-normal text-muted">
                    <th scope="col" className="px-4 py-3.5">#</th>
                    <th scope="col" className="px-4 py-3.5">Yazılım</th>
                    <th scope="col" className="px-4 py-3.5">Açıklama</th>
                    <th scope="col" className="px-4 py-3.5">Platform</th>
                    <th scope="col" className="px-4 py-3.5">Sürüm</th>
                    <th scope="col" className="px-4 py-3.5">Dosya Türü</th>
                    <th scope="col" className="px-4 py-3.5">Boyut</th>
                    <th scope="col" className="px-4 py-3.5">Fiyat</th>
                    <th scope="col" className="px-4 py-3.5">Ödeme Durumu</th>
                    <th scope="col" className="px-4 py-3.5">Yükle</th>
                    <th scope="col" className="px-4 py-3.5 text-right">İndir</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((pkg, index) => {
                    const access = accessMap[pkg.productId];
                    return (
                      <tr key={pkg.id} className="border-b border-line/80 last:border-b-0 hover:bg-[var(--bg-accent)]/70">
                        <td className="px-4 py-4 align-top text-muted">{index + 1}</td>
                        <th scope="row" className="max-w-[12rem] px-4 py-4 align-top text-[0.9375rem] font-semibold text-ink">
                          <span className="break-words">{pkg.name}</span>
                          <span className="mt-1 block text-xs font-normal text-muted">{formatShortDate(pkg.uploadedAt)}</span>
                        </th>
                        <td className="max-w-[16rem] px-4 py-4 align-top text-sm font-normal text-muted">
                          <span className="break-words leading-6">{pkg.description}</span>
                        </td>
                        <td className="min-w-[13.5rem] px-4 py-4 align-top">
                          <PlatformBadges platforms={pkg.platforms ?? []} />
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 align-top">{pkg.version}</td>
                        <td className="whitespace-nowrap px-4 py-4 align-top">{pkg.fileType}</td>
                        <td className="whitespace-nowrap px-4 py-4 align-top">{pkg.fileSize}</td>
                        <td className="whitespace-nowrap px-4 py-4 align-top">
                          {pkg.priceUsd == null
                            ? 'Fiyat tanımlanmadı'
                            : pkg.priceUsd === 0
                              ? 'Ücretsiz'
                              : formatMoney(pkg.priceUsd, pkg.currency || 'USD')}
                        </td>
                        <td className="px-4 py-4 align-top">{paymentBadge(access?.state)}</td>
                        <td className="px-4 py-4 align-top">
                          <button
                            type="button"
                            className="btn btn-secondary min-h-11 gap-1.5 px-3"
                            aria-label={`${pkg.name} için dosya yükle`}
                            onClick={(e) => void beginUpload(e.currentTarget)}
                          >
                            <Upload size={14} aria-hidden />
                            Yükle
                          </button>
                        </td>
                        <td className="px-4 py-4 align-top text-right">
                          <DownloadAction pkg={pkg} access={access} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {filtered.length === 0 ? (
              <div className="border-t border-line px-6 py-10 text-center" role="status">
                <p className="text-sm font-medium text-ink">Aramanızla eşleşen yazılım paketi bulunamadı.</p>
              </div>
            ) : null}
          </div>

          {/* Mobile cards */}
          <div className="mt-5 space-y-4 lg:hidden">
            {filtered.length === 0 ? (
              <p className="rounded-2xl border border-line bg-white px-5 py-8 text-center text-sm text-ink" role="status">
                Aramanızla eşleşen yazılım paketi bulunamadı.
              </p>
            ) : (
              filtered.map((pkg, index) => {
                const access = accessMap[pkg.productId];
                return (
                  <article key={pkg.id} className="rounded-2xl border border-line bg-white p-5 shadow-soft">
                    <p className="text-xs font-semibold text-muted">#{index + 1}</p>
                    <h3 className="mt-1 text-base font-semibold text-ink break-words">{pkg.name}</h3>
                    <p className="mt-2 text-sm leading-6 text-muted">{pkg.description}</p>
                    <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                      <div className="col-span-2">
                        <dt className="text-[11px] text-muted">Platform</dt>
                        <dd className="mt-1">
                          <PlatformBadges platforms={pkg.platforms ?? []} />
                        </dd>
                      </div>
                      <div><dt className="text-[11px] text-muted">Sürüm</dt><dd className="font-medium text-ink">{pkg.version}</dd></div>
                      <div><dt className="text-[11px] text-muted">Tür</dt><dd className="font-medium text-ink">{pkg.fileType}</dd></div>
                      <div><dt className="text-[11px] text-muted">Boyut</dt><dd className="font-medium text-ink">{pkg.fileSize}</dd></div>
                      <div><dt className="text-[11px] text-muted">Fiyat</dt><dd className="font-medium text-ink">{pkg.priceUsd == null ? 'Fiyat tanımlanmadı' : pkg.priceUsd === 0 ? 'Ücretsiz' : formatMoney(pkg.priceUsd, pkg.currency || 'USD')}</dd></div>
                      <div><dt className="text-[11px] text-muted">Ödeme</dt><dd className="mt-0.5">{paymentBadge(access?.state)}</dd></div>
                    </dl>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button type="button" className="btn btn-secondary min-h-11 gap-1.5" onClick={(e) => void beginUpload(e.currentTarget)}>
                        <Upload size={14} aria-hidden />
                        Yükle
                      </button>
                      <DownloadAction pkg={pkg} access={access} />
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </>
      )}

      <AdminLoginModal
        open={adminOpen}
        onClose={() => setAdminOpen(false)}
        returnFocusRef={triggerRef}
        onSuccess={() => {
          setAdminAuthed(true);
          setAdminOpen(false);
          setUploadOpen(true);
        }}
      />
      <AdminUploadModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        returnFocusRef={triggerRef}
        onUploaded={() => void refresh()}
      />
    </div>
  );
}

function DownloadAction({ pkg, access }: { pkg: PublicDownloadPackage; access?: AccessInfo }) {
  if (!pkg.fileAvailable || access?.state === 'no_file') {
    return (
      <button type="button" className="btn btn-primary min-h-11 gap-1.5 px-4" disabled aria-disabled="true">
        Dosya kullanılamıyor
      </button>
    );
  }
  if (access?.canDownload) {
    return (
      <a
        href={`/api/downloads/${encodeURIComponent(pkg.productId)}/file`}
        className="btn btn-primary inline-flex min-h-11 gap-1.5 px-4"
        aria-label={`${pkg.name} dosyasını indir`}
      >
        <Download size={15} aria-hidden />
        İndir
      </a>
    );
  }
  if (access?.state === 'payment_pending') {
    return (
      <button type="button" className="btn btn-primary min-h-11 px-4" disabled aria-disabled="true">
        Ödeme Bekleniyor
      </button>
    );
  }
  if (access?.paymentUrl || access?.state === 'purchase_required' || access?.state === 'payment_failed') {
    const href = access.paymentUrl || `/payment?productId=${encodeURIComponent(pkg.productId)}&period=once`;
    return (
      <BuyButton href={href} className="btn btn-primary min-h-11 gap-1.5 px-4">
        <Download size={15} aria-hidden />
        {access.label || 'Satın Al'}
      </BuyButton>
    );
  }
  if (access?.state === 'price_undefined') {
    return (
      <button type="button" className="btn btn-primary min-h-11 px-4" disabled aria-disabled="true">
        Fiyat tanımlanmadı
      </button>
    );
  }
  return (
    <button type="button" className="btn btn-primary min-h-11 px-4" disabled aria-disabled="true">
      İndir
    </button>
  );
}
