'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CloudUpload, FileArchive, X } from 'lucide-react';
import {
  DOWNLOAD_PLATFORM_IDS,
  DOWNLOAD_PLATFORM_LABELS,
} from '@/data/downloads';
import { acquireScrollLock } from '@/lib/scroll-lock';
import { BRAND_LEGAL_NAME } from '@/lib/site';

const MAX_FILE_SIZE_MB = (() => {
  const raw = Number(process.env.NEXT_PUBLIC_DOWNLOAD_MAX_FILE_SIZE_MB ?? '2048');
  return Number.isFinite(raw) && raw > 0 ? Math.min(raw, 8192) : 2048;
})();

const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

/** Align with server DOWNLOAD_ALLOWED_EXTENSIONS (excl. tar.gz compound handled server-side). */
const FILE_ACCEPT =
  '.zip,.dmg,.pkg,.exe,.msi,.apk,.txt,application/zip,application/x-zip-compressed,application/octet-stream,text/plain,application/vnd.android.package-archive';

const ALLOWED_EXTENSIONS = new Set(['zip', 'dmg', 'pkg', 'exe', 'msi', 'apk', 'txt']);

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function extensionOf(fileName: string): string | null {
  const base = fileName.split(/[/\\]/).pop()?.toLowerCase() ?? '';
  const parts = base.split('.');
  if (parts.length < 2) return null;
  return parts[parts.length - 1] ?? null;
}

function validateSelectedFile(file: File | null): string | null {
  if (!file) return 'Lütfen bir yazılım dosyası seçin.';
  if (!file.name.trim()) return 'Geçersiz dosya adı.';
  const ext = extensionOf(file.name);
  if (!ext || !ALLOWED_EXTENSIONS.has(ext)) {
    return 'Desteklenen türler: ZIP, DMG, PKG, EXE, MSI, APK, TXT.';
  }
  if (file.size <= 0) return 'Lütfen bir yazılım dosyası seçin.';
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return 'Dosya izin verilen maksimum boyutu aşıyor.';
  }
  return null;
}

type AdminUploadModalProps = {
  open: boolean;
  onClose: () => void;
  onUploaded: () => void;
  onAuthenticated?: () => void;
  initiallyAuthenticated?: boolean;
  returnFocusRef: React.MutableRefObject<HTMLElement | null>;
};

export function AdminUploadModal({
  open,
  onClose,
  onUploaded,
  onAuthenticated,
  initiallyAuthenticated = false,
  returnFocusRef,
}: AdminUploadModalProps) {
  const titleId = useId();
  const fileInputId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const codeInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const dragDepthRef = useRef(0);

  const [step, setStep] = useState<'auth' | 'upload'>(initiallyAuthenticated ? 'upload' : 'auth');
  const [adminCode, setAdminCode] = useState('');
  const [authPending, setAuthPending] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [pending, setPending] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const requestClose = useCallback(() => {
    if (pending || authPending) {
      const ok = window.confirm('İşlem devam ediyor. Modalı kapatmak istediğinize emin misiniz?');
      if (!ok) return;
    }
    onClose();
  }, [onClose, pending, authPending]);

  useEffect(() => {
    if (!open) return;
    return acquireScrollLock();
  }, [open]);

  useEffect(() => {
    if (!open) {
      setStep(initiallyAuthenticated ? 'upload' : 'auth');
      setAdminCode('');
      setAuthPending(false);
      setAuthError(null);
      setPending(false);
      setProgress(null);
      setError(null);
      setSuccess(null);
      setFile(null);
      setFileError(null);
      setDragging(false);
      dragDepthRef.current = 0;
      formRef.current?.reset();
      if (fileInputRef.current) fileInputRef.current.value = '';
      returnFocusRef.current?.focus();
      return;
    }

    let cancelled = false;
    const boot = async () => {
      if (initiallyAuthenticated) {
        setStep('upload');
        return;
      }
      try {
        const res = await fetch('/api/downloads/admin/session', { cache: 'no-store' });
        const json = (await res.json()) as { authenticated?: boolean };
        if (cancelled) return;
        if (json.authenticated) {
          setStep('upload');
          onAuthenticated?.();
        } else {
          setStep('auth');
        }
      } catch {
        if (!cancelled) setStep('auth');
      }
    };
    void boot();

    const t = window.setTimeout(() => {
      if (step === 'auth') codeInputRef.current?.focus();
      else closeRef.current?.focus();
    }, 60);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
    // intentionally only on open / initiallyAuthenticated
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initiallyAuthenticated, onAuthenticated, returnFocusRef]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        requestClose();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, requestClose]);

  useEffect(() => {
    if (!open || step !== 'auth') return;
    const t = window.setTimeout(() => codeInputRef.current?.focus(), 40);
    return () => window.clearTimeout(t);
  }, [open, step]);

  const onAuthSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (authPending) return;
    setAuthPending(true);
    setAuthError(null);
    try {
      const res = await fetch('/api/downloads/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: adminCode }),
      });
      const data = (await res.json()) as { error?: string; ok?: boolean };
      if (!res.ok) {
        setAuthError(data.error || 'Yönetici kodu hatalı.');
        return;
      }
      setAdminCode('');
      setStep('upload');
      onAuthenticated?.();
    } catch {
      setAuthError('Doğrulama başarısız. Lütfen tekrar deneyin.');
    } finally {
      setAuthPending(false);
    }
  };

  const applyFile = useCallback((next: File | null) => {
    if (!next) {
      setFile(null);
      setFileError(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    const validationError = validateSelectedFile(next);
    if (validationError) {
      setFile(null);
      setFileError(validationError);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    setFile(next);
    setFileError(null);
    setError(null);
    if (fileInputRef.current) {
      try {
        const dt = new DataTransfer();
        dt.items.add(next);
        fileInputRef.current.files = dt.files;
      } catch {
        // Controlled File state is still used on submit.
      }
    }
  }, []);

  const onDropZoneDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepthRef.current += 1;
    setDragging(true);
  };

  const onDropZoneDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
  };

  const onDropZoneDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) setDragging(false);
  };

  const onDropZoneDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepthRef.current = 0;
    setDragging(false);
    const dropped = e.dataTransfer.files?.[0] ?? null;
    applyFile(dropped);
  };

  const uploadWithProgress = (data: FormData) =>
    new Promise<{ ok: boolean; status: number; json: { error?: string; ok?: boolean } }>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/downloads/admin/upload');
      xhr.responseType = 'json';
      xhr.upload.onprogress = (event) => {
        if (!event.lengthComputable) return;
        setProgress(Math.min(99, Math.round((event.loaded / event.total) * 100)));
      };
      xhr.onload = () => {
        const raw = xhr.response;
        const json =
          raw && typeof raw === 'object'
            ? (raw as { error?: string; ok?: boolean })
            : (() => {
                try {
                  return JSON.parse(xhr.responseText || '{}') as { error?: string; ok?: boolean };
                } catch {
                  return {};
                }
              })();
        resolve({ ok: xhr.status >= 200 && xhr.status < 300, status: xhr.status, json });
      };
      xhr.onerror = () => reject(new Error('network'));
      xhr.onabort = () => reject(new Error('abort'));
      xhr.send(data);
    });

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;

    const validationError = validateSelectedFile(file);
    if (validationError) {
      setFileError(validationError);
      setError(validationError);
      return;
    }

    const form = event.currentTarget;
    const platforms = form.querySelectorAll<HTMLInputElement>('input[name="platforms"]:checked');
    if (platforms.length === 0) {
      setError('En az bir platform seçin.');
      return;
    }

    const data = new FormData(form);
    data.set('file', file as File);

    setPending(true);
    setProgress(0);
    setError(null);
    setSuccess(null);

    try {
      const result = await uploadWithProgress(data);
      if (!result.ok) {
        if (result.status === 401 || result.status === 403) {
          setStep('auth');
          setAuthError('Oturum sona erdi. Lütfen yönetici kodunu tekrar girin.');
          setProgress(null);
          return;
        }
        setError(result.json.error || 'Yükleme başarısız.');
        setProgress(null);
        return;
      }
      setProgress(100);
      setSuccess('Yazılım paketi başarıyla yüklendi.');
      form.reset();
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      onUploaded();
      window.setTimeout(() => onClose(), 900);
    } catch {
      setError('Yükleme başarısız.');
      setProgress(null);
    } finally {
      setPending(false);
    }
  };

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="upload-modal-overlay"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) requestClose();
      }}
    >
      <div className="upload-modal-panel" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <header className="upload-modal-header">
          <div className="min-w-0 pr-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-brand-600">{BRAND_LEGAL_NAME}</p>
            <h2 id={titleId} className="mt-1 text-base font-semibold text-ink sm:text-lg">
              {step === 'auth' ? 'Yönetici Doğrulaması' : 'Yazılım Paketi Yükle'}
            </h2>
            {step === 'auth' ? (
              <p className="mt-1 text-sm text-muted">Yazılım paketi yüklemek için yönetici kodunu girin.</p>
            ) : null}
          </div>
          <button
            ref={closeRef}
            type="button"
            aria-label="Kapat"
            className="btn btn-ghost h-9 w-9 shrink-0 p-0"
            onClick={requestClose}
          >
            <X size={18} aria-hidden />
          </button>
        </header>

        {step === 'auth' ? (
          <form className="upload-modal-form" onSubmit={onAuthSubmit}>
            <div className="upload-modal-body">
              <label className="block text-sm">
                <span className="font-medium text-ink">Yönetici Kodu</span>
                <input
                  ref={codeInputRef}
                  type="password"
                  name="adminCode"
                  autoComplete="off"
                  required
                  maxLength={256}
                  value={adminCode}
                  disabled={authPending}
                  onChange={(e) => setAdminCode(e.target.value)}
                  className="mt-1.5 h-11 w-full rounded-xl border border-line px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                />
              </label>
              {authError ? (
                <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
                  {authError}
                </p>
              ) : null}
            </div>
            <footer className="upload-modal-footer">
              <button type="button" className="btn btn-secondary min-h-11 flex-1 sm:flex-none" onClick={requestClose}>
                İptal
              </button>
              <button
                type="submit"
                className="btn btn-primary min-h-11 flex-1 sm:flex-none sm:min-w-[8.5rem]"
                disabled={authPending || !adminCode.trim()}
              >
                {authPending ? 'Doğrulanıyor…' : 'Devam Et'}
              </button>
            </footer>
          </form>
        ) : (
          <form ref={formRef} className="upload-modal-form" onSubmit={onSubmit} noValidate>
            <div className="upload-modal-body">
              <label className="block text-sm">
                <span className="font-medium text-ink">Yazılım adı</span>
                <input
                  name="name"
                  required
                  maxLength={120}
                  disabled={pending}
                  className="mt-1.5 h-11 w-full rounded-xl border border-line px-3 text-sm"
                />
              </label>

              <label className="block text-sm">
                <span className="font-medium text-ink">Kısa açıklama</span>
                <textarea
                  name="description"
                  required
                  maxLength={500}
                  rows={3}
                  disabled={pending}
                  className="mt-1.5 w-full rounded-xl border border-line px-3 py-2 text-sm"
                />
              </label>

              <fieldset className="block text-sm" disabled={pending}>
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

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm">
                  <span className="font-medium text-ink">Sürüm</span>
                  <input
                    name="version"
                    required
                    maxLength={40}
                    placeholder="v1.0.0"
                    disabled={pending}
                    className="mt-1.5 h-11 w-full rounded-xl border border-line px-3 text-sm"
                  />
                </label>
                <label className="block text-sm">
                  <span className="font-medium text-ink">Mimari</span>
                  <input
                    name="architecture"
                    defaultValue="Universal"
                    maxLength={40}
                    disabled={pending}
                    className="mt-1.5 h-11 w-full rounded-xl border border-line px-3 text-sm"
                  />
                </label>
                <label className="block text-sm sm:col-span-2">
                  <span className="font-medium text-ink">Fiyat (USD)</span>
                  <input
                    name="priceUsd"
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="Boş = satışa kapalı"
                    disabled={pending}
                    className="mt-1.5 h-11 w-full rounded-xl border border-line px-3 text-sm sm:max-w-xs"
                  />
                </label>
              </div>

              <div className="block text-sm">
                <span className="font-medium text-ink" id={`${fileInputId}-label`}>
                  Yazılım Dosyası <span className="text-red-600">*</span>
                </span>

                <input
                  ref={fileInputRef}
                  id={fileInputId}
                  name="file"
                  type="file"
                  accept={FILE_ACCEPT}
                  className="sr-only"
                  tabIndex={-1}
                  aria-labelledby={`${fileInputId}-label`}
                  disabled={pending}
                  onChange={(e) => {
                    applyFile(e.target.files?.[0] ?? null);
                  }}
                />

                {!file ? (
                  <div
                    role="button"
                    tabIndex={0}
                    aria-describedby={`${fileInputId}-hint`}
                    className={`upload-dropzone mt-1.5 ${dragging ? 'upload-dropzone-active' : ''}`}
                    onClick={() => {
                      if (!pending) fileInputRef.current?.click();
                    }}
                    onKeyDown={(e) => {
                      if (pending) return;
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        fileInputRef.current?.click();
                      }
                    }}
                    onDragEnter={onDropZoneDragEnter}
                    onDragOver={onDropZoneDragOver}
                    onDragLeave={onDropZoneDragLeave}
                    onDrop={onDropZoneDrop}
                  >
                    <CloudUpload className="mx-auto text-brand-600" size={32} aria-hidden />
                    <p className="mt-3 text-sm font-semibold text-ink">Dosyanızı buraya sürükleyin</p>
                    <p className="mt-1 text-xs text-muted">veya</p>
                    <button
                      type="button"
                      className="btn btn-secondary mt-3 min-h-10 px-4"
                      disabled={pending}
                      onClick={(e) => {
                        e.stopPropagation();
                        fileInputRef.current?.click();
                      }}
                    >
                      Dosya Seç
                    </button>
                    <p id={`${fileInputId}-hint`} className="mt-3 text-xs text-muted">
                      ZIP, DMG, PKG, EXE, MSI, APK, TXT
                      <br />
                      Maksimum dosya boyutu: {MAX_FILE_SIZE_MB.toLocaleString('tr-TR')} MB
                    </p>
                  </div>
                ) : (
                  <div
                    className={`upload-file-selected mt-1.5 ${dragging ? 'upload-dropzone-active' : ''}`}
                    onDragEnter={onDropZoneDragEnter}
                    onDragOver={onDropZoneDragOver}
                    onDragLeave={onDropZoneDragLeave}
                    onDrop={onDropZoneDrop}
                  >
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-brand-600">
                        <FileArchive size={20} aria-hidden />
                      </span>
                      <dl className="min-w-0 flex-1 space-y-1 text-sm">
                        <div>
                          <dt className="text-xs text-muted">Dosya</dt>
                          <dd className="truncate font-semibold text-ink" title={file.name}>
                            {file.name}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs text-muted">Boyut</dt>
                          <dd className="font-medium text-ink">{formatBytes(file.size)}</dd>
                        </div>
                        <div>
                          <dt className="text-xs text-muted">Durum</dt>
                          <dd className="font-medium text-emerald-700">
                            {pending ? 'Yükleniyor…' : 'Yüklemeye hazır'}
                          </dd>
                        </div>
                      </dl>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="btn btn-secondary min-h-10 px-3 text-sm"
                        disabled={pending}
                        onClick={() => fileInputRef.current?.click()}
                      >
                        Değiştir
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost min-h-10 px-3 text-sm"
                        disabled={pending}
                        onClick={() => applyFile(null)}
                      >
                        Kaldır
                      </button>
                    </div>
                  </div>
                )}

                {fileError ? <p className="mt-2 text-sm text-red-700">{fileError}</p> : null}
              </div>

              {progress != null ? (
                <div className="space-y-1.5" aria-live="polite">
                  <div className="flex items-center justify-between text-xs text-muted">
                    <span>{pending ? 'Yükleniyor…' : 'Tamamlandı'}</span>
                    <span>%{progress}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-brand-600 transition-[width] duration-200"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              ) : null}

              {error ? (
                <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
                  {error}
                </p>
              ) : null}
              {success ? (
                <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800" role="status">
                  {success}
                </p>
              ) : null}
            </div>

            <footer className="upload-modal-footer">
              <button type="button" className="btn btn-secondary min-h-11 flex-1 sm:flex-none" onClick={requestClose}>
                İptal
              </button>
              <button type="submit" className="btn btn-primary min-h-11 flex-1 sm:flex-none sm:min-w-[8.5rem]" disabled={pending}>
                {pending ? 'Yükleniyor…' : 'Yükle'}
              </button>
            </footer>
          </form>
        )}
      </div>
    </div>,
    document.body
  );
}
