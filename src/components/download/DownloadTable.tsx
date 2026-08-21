'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Download, Search, Upload, X } from 'lucide-react';
import { BuyButton } from '@/components/BuyButton';
import { AdminUploadModal } from '@/components/download/AdminUploadModal';
import {
  DOWNLOAD_PAGE_SIZE,
  DOWNLOAD_PLATFORM_LABELS,
  DOWNLOAD_TABLE_FILTERS,
  formatShortDate,
  matchesPlatformFilter,
  type DownloadPlatformFilter,
  type DownloadPlatformId,
} from '@/data/downloads';
import type { PublicDownloadPackage } from '@/lib/downloads/types';
import { formatMoney } from '@/lib/money';

type AccessInfo = {
  productId?: string;
  state: string;
  canDownload: boolean;
  label?: string;
  paymentUrl?: string;
  free?: boolean;
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

function paymentBadge(state: string | undefined) {
  if (state === 'download_ready') {
    return <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800">İndirilebilir</span>;
  }
  if (state === 'payment_pending') {
    return <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-900">Doğrulanıyor...</span>;
  }
  if (state === 'no_file' || state === 'unpublished') {
    return <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700">Henüz yayınlanmadı</span>;
  }
  if (state === 'price_undefined') {
    return <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700">Fiyat yok</span>;
  }
  if (state === 'payment_failed') {
    return <span className="inline-flex rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 text-[11px] font-semibold text-red-800">Ödeme başarısız</span>;
  }
  return <span className="inline-flex rounded-full border border-sky-200 bg-sky-50 px-2.5 py-0.5 text-[11px] font-semibold text-sky-800">Satın Al</span>;
}

export function DownloadTable() {
  const [packages, setPackages] = useState<PublicDownloadPackage[]>([]);
  const [accessMap, setAccessMap] = useState<Record<string, AccessInfo>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [platform, setPlatform] = useState<DownloadPlatformFilter>('all');
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

  const beginUpload = (opener: HTMLElement | null) => {
    triggerRef.current = opener;
    setUploadOpen(true);
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
          onClick={(e) => beginUpload(e.currentTarget)}
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
          <EmptyDownloadState onUpload={() => beginUpload(null)} />
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
                            onClick={(e) => beginUpload(e.currentTarget)}
                          >
                            <Upload size={14} aria-hidden />
                            Yükle
                          </button>
                        </td>
                        <td className="px-4 py-4 align-top text-right">
                          <DownloadAction pkg={pkg} access={access} accessLoading={loading} />
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
                      <button type="button" className="btn btn-secondary min-h-11 gap-1.5" onClick={(e) => beginUpload(e.currentTarget)}>
                        <Upload size={14} aria-hidden />
                        Yükle
                      </button>
                      <DownloadAction pkg={pkg} access={access} accessLoading={loading} />
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </>
      )}

      <AdminUploadModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        returnFocusRef={triggerRef}
        initiallyAuthenticated={adminAuthed}
        onAuthenticated={() => setAdminAuthed(true)}
        onUploaded={() => void refresh()}
      />
    </div>
  );
}

function DownloadAction({
  pkg,
  access,
  accessLoading,
}: {
  pkg: PublicDownloadPackage;
  access?: AccessInfo;
  accessLoading?: boolean;
}) {
  if (accessLoading && !access) {
    return (
      <button type="button" className="btn btn-secondary min-h-11 px-4" disabled aria-disabled="true">
        Doğrulanıyor...
      </button>
    );
  }

  if (!pkg.fileAvailable || access?.state === 'no_file' || access?.state === 'unpublished') {
    return (
      <button type="button" className="btn btn-secondary min-h-11 gap-1.5 px-4" disabled aria-disabled="true">
        Henüz yayınlanmadı
      </button>
    );
  }

  // Active download only when backend says canDownload — never invent a file URL otherwise.
  if (access?.canDownload === true) {
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
      <button type="button" className="btn btn-secondary min-h-11 px-4" disabled aria-disabled="true">
        Doğrulanıyor...
      </button>
    );
  }

  if (access?.state === 'price_undefined') {
    return (
      <button type="button" className="btn btn-secondary min-h-11 px-4" disabled aria-disabled="true">
        Fiyat tanımlanmadı
      </button>
    );
  }

  if (access?.paymentUrl || access?.state === 'purchase_required' || access?.state === 'payment_failed') {
    const href = access.paymentUrl || `/payment?productId=${encodeURIComponent(pkg.productId)}&period=once`;
    return (
      <BuyButton href={href} className="btn btn-primary min-h-11 gap-1.5 px-4">
        {access.label || 'Satın Al'}
      </BuyButton>
    );
  }

  // Locked: no href to file endpoint in the DOM.
  return (
    <button type="button" className="btn btn-secondary min-h-11 px-4" disabled aria-disabled="true" title="Ödeme gerekli">
      Satın Al
    </button>
  );
}
