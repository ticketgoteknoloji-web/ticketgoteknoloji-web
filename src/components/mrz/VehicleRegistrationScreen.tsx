'use client';

import { Camera, ImageUp, LoaderCircle, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import type { DocumentReaderResult, OnDocumentConfirmed } from '@/lib/document-reader/types';
import { adaptVehicleRegistrationResult, markUserConfirmed } from '@/lib/document-reader/adapter';
import type { VehicleRegistrationResult } from '@/lib/vehicle-registration/types';

const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
const ALLOWED_EXT = /\.(jpe?g|png|webp)$/i;

const FIELD_LABELS: Record<string, string> = {
  plate: 'Plaka',
  brand: 'Marka',
  model: 'Model',
  vehicleType: 'Araç Türü',
  vehicleClass: 'Araç Sınıfı',
  modelYear: 'Model Yılı',
  vin: 'Şasi / VIN',
  engineNumber: 'Motor No',
  fuelType: 'Yakıt',
  color: 'Renk',
  seatCount: 'Koltuk',
  firstRegistrationDate: 'İlk Tescil Tarihi',
  registrationDate: 'Tescil Tarihi',
  documentSerialNumber: 'Belge Seri No',
};

// Display order matches the fields requested for the result screen.
const FIELD_ORDER = [
  'plate',
  'brand',
  'model',
  'vehicleType',
  'vehicleClass',
  'modelYear',
  'vin',
  'engineNumber',
  'fuelType',
  'color',
  'seatCount',
  'firstRegistrationDate',
  'registrationDate',
  'documentSerialNumber',
];

function fileErrorMessage(file: File | null): string | null {
  if (!file) return 'Lütfen bir belge fotoğrafı seçin.';
  if (file.size <= 0) return 'Dosya boş görünüyor.';
  if (file.size > MAX_BYTES) return 'Dosya çok büyük (azami 8 MB).';
  const mime = (file.type || '').toLowerCase();
  const mimeOk = !mime || ALLOWED_MIME.has(mime);
  const extOk = ALLOWED_EXT.test(file.name || '') || ALLOWED_MIME.has(mime);
  if (!mimeOk || !extOk) return 'Yalnızca JPG, PNG veya WEBP dosyaları kabul edilir.';
  return null;
}

type Props = {
  onDocumentConfirmed?: OnDocumentConfirmed;
  onBack?: () => void;
};

export function VehicleRegistrationScreen({ onDocumentConfirmed, onBack }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewUrlRef = useRef<string | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<VehicleRegistrationResult | null>(null);
  const [editedValues, setEditedValues] = useState<Record<string, string>>({});
  const [confirmed, setConfirmed] = useState<DocumentReaderResult | null>(null);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraOn(false);
  }, []);

  useEffect(() => {
    return () => {
      stopCamera();
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, [stopCamera]);

  const setPreview = useCallback((next: File | null) => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    if (next) {
      const url = URL.createObjectURL(next);
      previewUrlRef.current = url;
      setPreviewUrl(url);
    } else {
      setPreviewUrl(null);
    }
  }, []);

  const startCamera = useCallback(async () => {
    setCameraError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('Bu tarayıcı kamera erişimini desteklemiyor. Fotoğraf yükleyebilirsiniz.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraOn(true);
    } catch {
      setCameraError('Kamera erişimi sağlanamadı. Belge fotoğrafı yükleyebilir veya bilgileri manuel girebilirsiniz.');
    }
  }, []);

  const capturePhoto = useCallback(() => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const captured = new File([blob], 'ruhsat.jpg', { type: 'image/jpeg' });
      setFile(captured);
      setPreview(captured);
      stopCamera();
    }, 'image/jpeg', 0.92);
  }, [setPreview, stopCamera]);

  const handleFileChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const next = event.target.files?.[0] ?? null;
      const err = fileErrorMessage(next);
      if (err) {
        setError(err);
        return;
      }
      setError(null);
      setFile(next);
      setPreview(next);
      event.target.value = '';
    },
    [setPreview],
  );

  const clearSelection = useCallback(() => {
    setFile(null);
    setPreview(null);
    setResult(null);
    setError(null);
  }, [setPreview]);

  const submit = useCallback(async () => {
    if (!file) {
      setError('Lütfen önce bir belge fotoğrafı seçin.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('dosya', file, file.name || 'ruhsat.jpg');
      const response = await fetch('/api/vehicle-registration/scan', { method: 'POST', body: form });
      const body = (await response.json()) as VehicleRegistrationResult;
      if (!body.success) {
        setError('Belge okunamadı. Lütfen tekrar deneyin veya daha net bir fotoğraf çekin.');
        setResult(body);
        return;
      }
      setResult(body);
      const initial: Record<string, string> = {};
      for (const key of FIELD_ORDER) {
        initial[key] = body.fields[key as keyof typeof body.fields]?.value ?? '';
      }
      setEditedValues(initial);
    } catch {
      setError('Sunucuya bağlanılamadı. Lütfen tekrar deneyin.');
    } finally {
      setBusy(false);
    }
  }, [file]);

  const handleConfirm = useCallback(() => {
    if (!result || !result.success) return;
    const mergedFields = Object.fromEntries(
      Object.entries(result.fields).map(([key, f]) => [key, { ...f, value: editedValues[key] ?? f.value }]),
    ) as typeof result.fields;
    const mergedResult: VehicleRegistrationResult = { ...result, fields: mergedFields };
    const readerResult = markUserConfirmed(adaptVehicleRegistrationResult(mergedResult));
    setConfirmed(readerResult);
    onDocumentConfirmed?.(readerResult);
  }, [result, editedValues, onDocumentConfirmed]);

  if (confirmed) {
    return (
      <div className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-sm font-semibold text-emerald-700">Bilgiler onaylandı</p>
        <p className="mt-1 text-sm text-slate-600">
          Ruhsat bilgileri onaylandı. Bu aşamada gerçek bir rezervasyon sistemine gönderim yapılmadı.
        </p>
        <button
          type="button"
          onClick={() => {
            setConfirmed(null);
            clearSelection();
          }}
          className="mt-4 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Yeni Belge Tara
        </button>
      </div>
    );
  }

  return (
    <div>
      {onBack ? (
        <button type="button" onClick={onBack} className="mb-4 text-sm font-medium text-slate-500 hover:text-slate-800">
          ← Belge türünü değiştir
        </button>
      ) : null}

      <h2 className="text-xl font-semibold text-slate-900">Araç Ruhsatı</h2>
      <p className="mt-1 text-sm text-slate-600">Ruhsatınızı yükleyin veya kamerayla tarayın.</p>

      <fieldset className="mt-6">
        <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={busy}
            className="flex min-h-[8.5rem] flex-col items-start justify-between rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:border-[#1d4ed8]/35 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d4ed8] disabled:opacity-60"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-[#1e3a8a]">
              <ImageUp className="h-5 w-5" aria-hidden />
            </span>
            <span>
              <span className="block text-base font-semibold text-slate-900">Fotoğraf Yükle</span>
              <span className="mt-1 block text-xs leading-5 text-slate-500">JPG · JPEG · PNG · WEBP</span>
            </span>
          </button>
          <button
            type="button"
            onClick={startCamera}
            disabled={busy}
            className="flex min-h-[8.5rem] flex-col items-start justify-between rounded-2xl bg-[#1d4ed8] p-5 text-left text-white shadow-sm transition hover:bg-[#1e40af] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d4ed8] focus-visible:ring-offset-2 disabled:opacity-60"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15">
              <Camera className="h-5 w-5" aria-hidden />
            </span>
            <span>
              <span className="block text-base font-semibold">Kamerayla Tara</span>
              <span className="mt-1 block text-xs leading-5 text-blue-100">Mobil cihazda arka kamerayı açar</span>
            </span>
          </button>
        </div>
      </fieldset>

      <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleFileChange} />

      {cameraOn ? (
        <div className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-black shadow-sm">
          <video ref={videoRef} className="max-h-80 w-full bg-black object-contain" playsInline muted autoPlay />
          <div className="flex gap-3 bg-white p-4">
            <button
              type="button"
              onClick={capturePhoto}
              className="min-h-[2.75rem] flex-1 rounded-full bg-[#1d4ed8] text-sm font-semibold text-white hover:bg-[#1e40af]"
            >
              Fotoğrafı Çek
            </button>
            <button
              type="button"
              onClick={stopCamera}
              className="inline-flex min-h-[2.75rem] items-center justify-center rounded-full border border-slate-200 px-4 text-sm font-semibold text-slate-700"
            >
              <span className="sr-only">Kamerayı kapat</span>
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </div>
      ) : null}

      {cameraError ? <p className="mt-3 text-sm text-amber-700">{cameraError}</p> : null}

      {previewUrl ? (
        <div className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {/* eslint-disable-next-line @next/next/no-img-element -- object URL from a captured/uploaded File, not a static asset */}
          <img src={previewUrl} alt="Yüklenen ruhsat önizlemesi" className="max-h-72 w-full bg-slate-50 object-contain" />
          <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-4 py-3">
            <p className="text-xs text-slate-500">{busy ? 'Belge okunuyor…' : 'Belge seçildi'}</p>
            <button type="button" onClick={clearSelection} disabled={busy} className="text-xs font-semibold text-slate-600 hover:text-slate-900">
              Kaldır
            </button>
          </div>
        </div>
      ) : null}

      {file && !result ? (
        <button
          type="button"
          onClick={submit}
          disabled={busy}
          className="mt-5 min-h-[3rem] w-full rounded-full bg-slate-900 px-5 text-sm font-semibold text-white transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2 disabled:opacity-60"
        >
          {busy ? (
            <span className="flex items-center justify-center gap-2">
              <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> Okunuyor…
            </span>
          ) : (
            'Belgeyi Oku'
          )}
        </button>
      ) : null}

      {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}

      {result && result.success ? (
        <div className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4">
            <p className="text-sm font-semibold text-slate-900">Okunan Bilgiler</p>
            <p className="mt-1 text-xs text-slate-500">
              Bu bilgiler OCR ile okunmuştur; resmi bir devlet doğrulaması değildir. Onaylamadan önce kontrol edin.
            </p>
          </div>
          <dl className="divide-y divide-slate-100 px-5">
            {FIELD_ORDER.map((key) => (
              <div key={key} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between">
                <dt className="text-sm text-slate-500">{FIELD_LABELS[key]}</dt>
                <dd className="sm:w-1/2">
                  <input
                    type="text"
                    value={editedValues[key] ?? ''}
                    onChange={(e) => setEditedValues((prev) => ({ ...prev, [key]: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-right text-sm font-medium text-slate-900 focus:border-[#1d4ed8] focus:outline-none sm:text-left"
                  />
                </dd>
              </div>
            ))}
          </dl>
          <div className="flex gap-3 border-t border-slate-100 p-4">
            <button
              type="button"
              onClick={clearSelection}
              className="min-h-[2.75rem] flex-1 rounded-full border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Tekrar Tara
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className="min-h-[2.75rem] flex-1 rounded-full bg-[#1d4ed8] text-sm font-semibold text-white hover:bg-[#1e40af]"
            >
              Bilgileri Onayla
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
