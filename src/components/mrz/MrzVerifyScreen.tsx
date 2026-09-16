'use client';

import { Camera, ImageUp, LoaderCircle, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';

const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
const ALLOWED_EXT = /\.(jpe?g|png|webp)$/i;

type DocKind = 'passport' | 'tc_id_front';

type FieldStatus = 'valid' | 'invalid' | 'missing';

type TcFieldDetail = {
  value?: string;
  confidence?: number;
  source?: string;
  valid?: boolean;
};

type VerifyResult = {
  success?: boolean;
  verified?: boolean;
  status?: string;
  errorCode?: string;
  message?: string;
  sessionId?: string;
  documentType?: string;
  verificationScore?: number;
  firstName?: string;
  lastName?: string;
  nationality?: string;
  birthDate?: string;
  gender?: string;
  expiryDate?: string;
  documentNumber?: string;
  // T.C. kimlik ön yüz
  ad?: string;
  soyad?: string;
  tcKimlikNo?: string;
  dogumTarihi?: string;
  cinsiyet?: string;
  fields?: {
    ad?: TcFieldDetail;
    soyad?: TcFieldDetail;
    tcKimlikNo?: TcFieldDetail;
    dogumTarihi?: TcFieldDetail;
    cinsiyet?: TcFieldDetail;
  };
  fieldStatus?: {
    ad?: FieldStatus;
    soyad?: FieldStatus;
    tcKimlikNo?: FieldStatus;
    dogumTarihi?: FieldStatus;
    cinsiyet?: FieldStatus;
  };
  allRequiredValid?: boolean;
};

function fileErrorMessage(file: File | null): string | null {
  if (!file) return 'Lütfen bir belge seçin.';
  if (file.size <= 0) return 'Dosya boş görünüyor.';
  if (file.size > MAX_BYTES) return 'Dosya 8 MB sınırını aşıyor.';
  const mime = (file.type || '').toLowerCase();
  const mimeOk = !mime || ALLOWED_MIME.has(mime);
  const extOk = ALLOWED_EXT.test(file.name) || ALLOWED_MIME.has(mime);
  if (!mimeOk || !extOk) return 'Yalnızca JPG, JPEG, PNG veya WEBP yükleyebilirsiniz.';
  return null;
}

function errorText(code?: string, apiMessage?: string): string {
  if (code === 'MRZ_NOT_FOUND') {
    return apiMessage || 'Belgede okunabilir geçerli MRZ alanı bulunamadı.';
  }
  switch (code) {
    case 'PAYLOAD_TOO_LARGE':
      return 'Dosya 8 MB sınırını aşıyor.';
    case 'NOT_CONFIGURED':
      return 'Doğrulama servisi şu anda kullanılamıyor.';
    case 'MRZ_SERVICE_ERROR':
      return 'Belge okunamadı. Lütfen daha net bir görselle tekrar deneyin.';
    case 'INVALID_INPUT':
      return 'Geçersiz dosya. JPG, JPEG, PNG veya WEBP seçin.';
    default:
      return apiMessage || 'Belge okunamadı. Lütfen tekrar deneyin.';
  }
}

function isMobileDevice() {
  if (typeof navigator === 'undefined') return false;
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function Field({ label, value }: { label: string; value?: string | number | boolean | null }) {
  if (value === undefined || value === null || value === '') return null;
  return (
    <div className="flex justify-between gap-4 border-b border-slate-100 py-2.5 last:border-0">
      <dt className="text-sm text-slate-500">{label}</dt>
      <dd className="text-right text-sm font-medium text-slate-900">{String(value)}</dd>
    </div>
  );
}

function statusLabel(status: FieldStatus): string {
  if (status === 'valid') return 'GEÇERLİ';
  if (status === 'invalid') return 'GEÇERSİZ';
  return 'EKSİK';
}

function TcField({
  label,
  value,
  status,
}: {
  label: string;
  value?: string;
  status: FieldStatus;
}) {
  const ok = status === 'valid';
  const display = value && value.trim() ? value : 'Okunamadı';
  return (
    <div
      className={`flex items-start justify-between gap-4 border-b py-3 last:border-0 ${
        ok ? 'border-emerald-100' : 'border-rose-100'
      }`}
    >
      <div>
        <dt className="text-sm font-medium text-slate-700">{label}</dt>
        <p className={`mt-0.5 text-[0.6875rem] font-semibold tracking-wide ${ok ? 'text-emerald-700' : 'text-rose-700'}`}>
          {statusLabel(status)}
        </p>
      </div>
      <dd className={`text-right text-sm font-semibold ${ok ? 'text-emerald-900' : 'text-rose-800'}`}>{display}</dd>
    </div>
  );
}

function detailStatus(detail: TcFieldDetail | undefined, fallback?: FieldStatus): FieldStatus {
  if (detail && typeof detail.valid === 'boolean') {
    if (detail.valid) return 'valid';
    return detail.value ? 'invalid' : 'missing';
  }
  return fallback ?? 'missing';
}

function detailValue(detail: TcFieldDetail | undefined, flat?: string): string {
  if (detail && typeof detail.value === 'string') return detail.value;
  return String(flat || '');
}

function isTcIdFrontResult(r: VerifyResult | null): boolean {
  if (!r || r.errorCode) return false;
  if (r.status === 'TC_ID_FRONT_OK' || r.status === 'TC_ID_FRONT_PARTIAL') return true;
  if (r.fieldStatus) return true;
  if (r.success !== undefined || r.verified !== undefined || r.firstName !== undefined) return false;
  return 'ad' in r || 'soyad' in r || 'tcKimlikNo' in r || 'dogumTarihi' in r || 'cinsiyet' in r;
}

export function MrzVerifyScreen() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const previewUrlRef = useRef<string | null>(null);

  const [docKind, setDocKind] = useState<DocKind>('tc_id_front');
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [result, setResult] = useState<VerifyResult | null>(null);

  const clearPreview = useCallback(() => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setPreviewUrl(null);
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraOpen(false);
  }, []);

  useEffect(
    () => () => {
      clearPreview();
      stopCamera();
    },
    [clearPreview, stopCamera],
  );

  const readDocument = useCallback(
    async (selected: File, kind: DocKind) => {
      setBusy(true);
      setMessage(null);
      setResult(null);
      try {
        const body = new FormData();
        body.append('dosya', selected, selected.name || 'document.jpg');
        body.append('document_hint', kind === 'tc_id_front' ? 'tc_id_front' : 'passport');
        body.append('sessionId', crypto.randomUUID());
        const response = await fetch('/api/identity/verify', {
          method: 'POST',
          body,
          signal: AbortSignal.timeout(180_000),
        });
        const json = (await response.json()) as VerifyResult & {
          extracted?: VerifyResult;
          response?: { extracted?: VerifyResult };
        };

        if (kind === 'tc_id_front') {
          if (json.errorCode) {
            setResult(json);
            setMessage(errorText(json.errorCode, json.message));
            return;
          }
          const details = json.fields;
          const fields = {
            ad: detailValue(details?.ad, json.ad),
            soyad: detailValue(details?.soyad, json.soyad),
            tcKimlikNo: detailValue(details?.tcKimlikNo, json.tcKimlikNo),
            dogumTarihi: detailValue(details?.dogumTarihi, json.dogumTarihi),
            cinsiyet: detailValue(details?.cinsiyet, json.cinsiyet),
          };
          const fieldStatus = {
            ad: detailStatus(details?.ad, json.fieldStatus?.ad),
            soyad: detailStatus(details?.soyad, json.fieldStatus?.soyad),
            tcKimlikNo: detailStatus(details?.tcKimlikNo, json.fieldStatus?.tcKimlikNo),
            dogumTarihi: detailStatus(details?.dogumTarihi, json.fieldStatus?.dogumTarihi),
            cinsiyet: detailStatus(details?.cinsiyet, json.fieldStatus?.cinsiyet),
          };
          const allRequiredValid =
            typeof json.allRequiredValid === 'boolean'
              ? json.allRequiredValid
              : Object.values(fieldStatus).every((s) => s === 'valid');
          setResult({
            ...fields,
            fields: details,
            fieldStatus,
            allRequiredValid,
            status: allRequiredValid ? 'TC_ID_FRONT_OK' : 'TC_ID_FRONT_PARTIAL',
          });
          setMessage(
            allRequiredValid
              ? 'Kimlik başarıyla okundu.'
              : 'Bazı zorunlu alanlar okunamadı veya geçersiz. Kırmızı alanları kontrol edin.',
          );
          return;
        }

        const nested = json.extracted ?? json.response?.extracted;
        const normalized: VerifyResult = { ...nested, ...json };
        setResult(normalized);
        if (normalized.errorCode) {
          setMessage(errorText(normalized.errorCode, normalized.message));
        } else if (normalized.success === false && normalized.status === 'ERROR') {
          setMessage(errorText(normalized.errorCode, normalized.message));
        } else if (normalized.success === false && normalized.status === 'REJECTED') {
          setMessage(errorText(normalized.errorCode, normalized.message));
        }
      } catch {
        setMessage('Bağlantı zaman aşımına uğradı veya kesildi. Lütfen tekrar deneyin.');
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  const applyFile = useCallback(
    (next: File | null) => {
      setResult(null);
      const err = fileErrorMessage(next);
      if (err) {
        setFile(null);
        clearPreview();
        setMessage(err);
        return;
      }
      if (!next) return;
      clearPreview();
      const url = URL.createObjectURL(next);
      previewUrlRef.current = url;
      setPreviewUrl(url);
      setFile(next);
      setMessage(null);
    },
    [clearPreview],
  );

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    applyFile(event.target.files?.[0] ?? null);
    event.target.value = '';
  }

  async function openCamera() {
    if (busy) return;
    stopCamera();
    if (isMobileDevice()) {
      cameraInputRef.current?.click();
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      cameraInputRef.current?.click();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      streamRef.current = stream;
      setCameraOpen(true);
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play();
        }
      });
    } catch {
      cameraInputRef.current?.click();
    }
  }

  async function captureFrame() {
    const video = videoRef.current;
    if (!video || video.videoWidth < 2) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
    stopCamera();
    if (!blob) {
      setMessage('Kamera görüntüsü alınamadı. Lütfen tekrar deneyin.');
      return;
    }
    applyFile(new File([blob], 'kamera.jpg', { type: 'image/jpeg' }));
  }

  function resetAll() {
    stopCamera();
    setFile(null);
    setResult(null);
    setMessage(null);
    clearPreview();
  }

  const verified = result?.verified === true && result?.status === 'VERIFIED';
  const tcResult = isTcIdFrontResult(result);

  return (
    <div className="mrz-app min-h-screen bg-[#f8fafc] text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-xl items-center px-4 py-4 sm:px-6">
          <div className="inline-flex flex-col items-start" aria-label="TicketGo Teknoloji A.Ş.">
            <span
              className="font-sans text-[1.625rem] font-bold leading-none tracking-tight sm:text-[1.875rem]"
              aria-hidden="true"
            >
              <span className="text-[#1e3a8a]">ticket</span>
              <span className="text-[#0ea5e9]">Go</span>
            </span>
            <span className="mt-0.5 font-sans text-[0.6875rem] font-medium leading-none tracking-[0.1em] text-[#1e3a8a]/75">
              Teknoloji A.Ş.
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-xl px-4 py-10 sm:px-6 sm:py-14">
        <h1 className="text-[1.75rem] font-semibold leading-tight tracking-tight text-slate-900 sm:text-[2rem]">
          Pasaport / Kimlik Belgesi Okuma
        </h1>
        <p className="mt-3 text-base text-slate-600">Belgenizi yükleyin veya kamerayla tarayın.</p>

        <fieldset className="mt-6">
          <legend className="text-sm font-medium text-slate-700">Belge türü</legend>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <label
              className={`flex cursor-pointer items-center gap-2 rounded-xl border px-4 py-3 text-sm ${
                docKind === 'tc_id_front'
                  ? 'border-[#1d4ed8] bg-blue-50 text-slate-900'
                  : 'border-slate-200 bg-white text-slate-700'
              }`}
            >
              <input
                type="radio"
                name="docKind"
                value="tc_id_front"
                checked={docKind === 'tc_id_front'}
                onChange={() => {
                  setDocKind('tc_id_front');
                  setResult(null);
                  setMessage(null);
                }}
                disabled={busy}
              />
              T.C. Kimlik Ön Yüz
            </label>
            <label
              className={`flex cursor-pointer items-center gap-2 rounded-xl border px-4 py-3 text-sm ${
                docKind === 'passport'
                  ? 'border-[#1d4ed8] bg-blue-50 text-slate-900'
                  : 'border-slate-200 bg-white text-slate-700'
              }`}
            >
              <input
                type="radio"
                name="docKind"
                value="passport"
                checked={docKind === 'passport'}
                onChange={() => {
                  setDocKind('passport');
                  setResult(null);
                  setMessage(null);
                }}
                disabled={busy}
              />
              Pasaport
            </label>
          </div>
        </fieldset>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
          className="hidden"
          onChange={onFileChange}
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp,image/*"
          capture="environment"
          className="hidden"
          onChange={onFileChange}
        />

        <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => fileInputRef.current?.click()}
            className="flex min-h-[8.5rem] flex-col items-start justify-between rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:border-[#1d4ed8]/35 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d4ed8] disabled:opacity-60"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-[#1e3a8a]">
              <ImageUp size={20} strokeWidth={2} />
            </span>
            <span>
              <span className="block text-base font-semibold text-slate-900">Dosya Seç</span>
              <span className="mt-1 block text-xs leading-5 text-slate-500">JPG · JPEG · PNG · WEBP</span>
            </span>
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void openCamera()}
            className="flex min-h-[8.5rem] flex-col items-start justify-between rounded-2xl bg-[#1d4ed8] p-5 text-left text-white shadow-sm transition hover:bg-[#1e40af] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d4ed8] focus-visible:ring-offset-2 disabled:opacity-60"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15">
              <Camera size={20} strokeWidth={2} />
            </span>
            <span>
              <span className="block text-base font-semibold">Kamerayla Tara</span>
              <span className="mt-1 block text-xs leading-5 text-blue-100">Mobil cihazda kamerayı açar</span>
            </span>
          </button>
        </div>

        {cameraOpen ? (
          <div className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-black shadow-sm">
            <video ref={videoRef} className="max-h-80 w-full bg-black object-contain" playsInline muted autoPlay />
            <div className="flex gap-3 bg-white p-4">
              <button
                type="button"
                onClick={() => void captureFrame()}
                className="min-h-[2.75rem] flex-1 rounded-full bg-[#1d4ed8] text-sm font-semibold text-white hover:bg-[#1e40af]"
              >
                Fotoğraf Çek
              </button>
              <button
                type="button"
                onClick={stopCamera}
                className="inline-flex min-h-[2.75rem] items-center justify-center rounded-full border border-slate-200 px-4 text-sm font-semibold text-slate-700"
              >
                <X size={16} />
                <span className="sr-only">Kamerayı kapat</span>
              </button>
            </div>
          </div>
        ) : null}

        {previewUrl ? (
          <div className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={previewUrl} alt="Yüklenen belge önizlemesi" className="max-h-72 w-full bg-slate-50 object-contain" />
            <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-4 py-3">
              <p className="text-xs text-slate-500">{busy ? 'Belge okunuyor…' : 'Belge seçildi'}</p>
              <button
                type="button"
                className="text-xs font-semibold text-slate-600 hover:text-slate-900"
                onClick={resetAll}
                disabled={busy}
              >
                Temizle
              </button>
            </div>
          </div>
        ) : null}

        {busy ? (
          <p className="mt-5 flex items-center gap-2 text-sm text-slate-600" role="status">
            <LoaderCircle className="h-4 w-4 animate-spin text-[#1d4ed8]" />
            Belge okunuyor, lütfen bekleyin…
          </p>
        ) : null}

        {file && !busy ? (
          <button
            type="button"
            onClick={() => void readDocument(file, docKind)}
            className="mt-5 min-h-[3rem] w-full rounded-full bg-slate-900 px-5 text-sm font-semibold text-white transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2"
          >
            Belgeyi Oku
          </button>
        ) : null}

        {message ? (
          <p
            className={`mt-4 rounded-xl border px-4 py-3 text-sm ${
              result && isTcIdFrontResult(result) && result.allRequiredValid
                ? 'border-emerald-200 bg-emerald-50 text-emerald-950'
                : 'border-amber-200 bg-amber-50 text-amber-950'
            }`}
            role="status"
          >
            {message}
          </p>
        ) : null}

        {tcResult && result ? (
          <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">Okuma sonucu</h2>
            <dl className="mt-4">
              <TcField
                label="Ad"
                value={result.ad}
                status={detailStatus(result.fields?.ad, result.fieldStatus?.ad)}
              />
              <TcField
                label="Soyad"
                value={result.soyad}
                status={detailStatus(result.fields?.soyad, result.fieldStatus?.soyad)}
              />
              <TcField
                label="T.C. Kimlik No"
                value={result.tcKimlikNo}
                status={detailStatus(result.fields?.tcKimlikNo, result.fieldStatus?.tcKimlikNo)}
              />
              <TcField
                label="Doğum Tarihi"
                value={result.dogumTarihi}
                status={detailStatus(result.fields?.dogumTarihi, result.fieldStatus?.dogumTarihi)}
              />
              <TcField
                label="Cinsiyet"
                value={result.cinsiyet}
                status={detailStatus(result.fields?.cinsiyet, result.fieldStatus?.cinsiyet)}
              />
            </dl>
          </section>
        ) : null}

        {result && !result.errorCode && !tcResult ? (
          <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-slate-900">Okuma sonucu</h2>
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  verified ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {verified ? 'Doğrulandı' : String(result.status ?? 'Sonuç')}
              </span>
            </div>
            <dl className="mt-4">
              <Field label="Durum" value={result.status} />
              <Field label="Belge türü" value={result.documentType} />
              <Field label="Doğrulama skoru" value={result.verificationScore} />
              <Field label="Ad" value={result.firstName} />
              <Field label="Soyad" value={result.lastName} />
              <Field label="Uyruk" value={result.nationality} />
              <Field label="Doğum tarihi" value={result.birthDate} />
              <Field label="Cinsiyet" value={result.gender} />
              <Field label="Son kullanma" value={result.expiryDate} />
              <Field label="Belge no" value={result.documentNumber} />
            </dl>
          </section>
        ) : null}
      </main>
    </div>
  );
}
