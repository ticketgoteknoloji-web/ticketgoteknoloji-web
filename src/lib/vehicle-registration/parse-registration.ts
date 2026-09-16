import 'server-only';

import { randomUUID } from 'crypto';
import { normalizeTurkishDate, normalizeWhitespace } from './normalize-registration';
import { validatePlate } from './plate-validator';
import { validateVin } from './vin-validator';
import type {
  RawGeneralOcrError,
  RawGeneralOcrResponse,
  RawVehicleRegistrationFields,
  VehicleField,
  VehicleRegistrationFieldsResult,
  VehicleRegistrationResult,
} from './types';

/**
 * Vehicle-registration OCR client.
 *
 * Reuses the EXISTING ticketgo-mrz-service PaddleOCR deployment via its
 * already-present `/v1/ocr/read` endpoint (document_hint=vehicle_registration)
 * — no new OCR engine, no new Python endpoint, no new npm dependency. This
 * mirrors the same env-var / Bearer-token pattern the passport/identity
 * side already documents in .env.example (MRZ_OCR_BASE_URL, MRZ_OCR_API_KEY,
 * falling back to MRZ_API_KEY), so no hard-coded host is introduced here.
 */

const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
const ALLOWED_EXT = /\.(jpe?g|png|webp)$/i;

export type VehicleOcrErrorCode = 'INVALID_INPUT' | 'NOT_CONFIGURED' | 'OCR_SERVICE_ERROR' | 'PAYLOAD_TOO_LARGE';

function vehicleConfig(): { baseUrl: string; apiKey: string } | null {
  const baseUrl = (process.env.MRZ_OCR_BASE_URL ?? '').trim().replace(/\/+$/, '');
  const apiKey = (process.env.MRZ_OCR_API_KEY ?? process.env.MRZ_API_KEY ?? '').trim();
  if (!baseUrl || !apiKey) return null;
  return { baseUrl, apiKey };
}

export function validateVehicleImageFile(file: File | null): VehicleOcrErrorCode | null {
  if (!file || typeof file.size !== 'number' || file.size <= 0) return 'INVALID_INPUT';
  if (file.size > MAX_BYTES) return 'PAYLOAD_TOO_LARGE';
  const mime = (file.type || '').toLowerCase();
  const name = file.name || '';
  const mimeOk = !mime || ALLOWED_MIME.has(mime);
  const extOk = ALLOWED_EXT.test(name) || ALLOWED_MIME.has(mime);
  if (!mimeOk || !extOk) return 'INVALID_INPUT';
  return null;
}

function buildField(params: {
  rawValue: string | null;
  normalizedValue: string | null;
  validated: boolean | null; // null = no format validation applies to this field
}): VehicleField {
  const { rawValue, normalizedValue, validated } = params;
  const value = normalizedValue && normalizedValue.length > 0 ? normalizedValue : null;
  const status: VehicleField['status'] =
    value === null ? 'missing' : validated === null ? 'unvalidated' : validated ? 'valid' : 'invalid';
  return {
    value,
    originalValue: rawValue && rawValue.length > 0 ? rawValue : null,
    confidence: null, // /v1/ocr/read does not currently return a per-field confidence, only per-line
    validated: validated === true,
    status,
  };
}

function mapRawFields(raw: RawVehicleRegistrationFields): VehicleRegistrationFieldsResult {
  const plateResult = raw.plate ? validatePlate(raw.plate) : null;
  const vinResult = raw.vin ? validateVin(raw.vin) : null;

  return {
    plate: buildField({
      rawValue: raw.plate,
      normalizedValue: plateResult ? plateResult.displayValue : null,
      validated: raw.plate ? plateResult!.validated : null,
    }),
    vin: buildField({
      rawValue: raw.vin,
      normalizedValue: vinResult ? vinResult.normalized : null,
      validated: raw.vin ? vinResult!.validated : null,
    }),
    brand: buildField({ rawValue: raw.brand, normalizedValue: raw.brand ? normalizeWhitespace(raw.brand) : null, validated: null }),
    model: buildField({ rawValue: raw.model, normalizedValue: raw.model ? normalizeWhitespace(raw.model) : null, validated: null }),
    vehicleType: buildField({
      rawValue: raw.vehicleType,
      normalizedValue: raw.vehicleType,
      validated: null,
    }),
    vehicleClass: buildField({
      rawValue: raw.vehicleClass,
      normalizedValue: raw.vehicleClass ? normalizeWhitespace(raw.vehicleClass) : null,
      validated: null,
    }),
    modelYear: buildField({ rawValue: raw.modelYear, normalizedValue: raw.modelYear, validated: null }),
    engineNumber: buildField({
      rawValue: raw.engineNumber,
      normalizedValue: raw.engineNumber ? normalizeWhitespace(raw.engineNumber) : null,
      validated: null,
    }),
    fuelType: buildField({ rawValue: raw.fuelType, normalizedValue: raw.fuelType, validated: null }),
    color: buildField({ rawValue: raw.color, normalizedValue: raw.color ? normalizeWhitespace(raw.color) : null, validated: null }),
    seatCount: buildField({ rawValue: raw.seatCount, normalizedValue: raw.seatCount, validated: null }),
    firstRegistrationDate: buildField({
      rawValue: raw.firstRegistrationDate,
      normalizedValue: normalizeTurkishDate(raw.firstRegistrationDate) ?? raw.firstRegistrationDate,
      validated: null,
    }),
    registrationDate: buildField({
      rawValue: raw.registrationDate,
      normalizedValue: normalizeTurkishDate(raw.registrationDate) ?? raw.registrationDate,
      validated: null,
    }),
    // Python's field is named `documentNumber`; the product's canonical
    // name on this side is `documentSerialNumber` — mapped here, not renamed upstream.
    documentSerialNumber: buildField({
      rawValue: raw.documentNumber,
      normalizedValue: raw.documentNumber ? normalizeWhitespace(raw.documentNumber) : null,
      validated: null,
    }),
    ownerName: buildField({
      rawValue: raw.ownerName,
      normalizedValue: raw.ownerName ? normalizeWhitespace(raw.ownerName) : null,
      validated: null,
    }),
  };
}

function looksLikeHtml(text: string): boolean {
  const s = text.trim().slice(0, 64).toLowerCase();
  return s.startsWith('<!doctype') || s.startsWith('<html') || s.startsWith('<head');
}

/**
 * Calls the existing PaddleOCR-backed /v1/ocr/read endpoint with
 * document_hint=vehicle_registration and maps the response into a
 * VehicleRegistrationResult. Never sends the image anywhere else, never
 * persists it, and never logs raw plate/VIN/document values.
 */
export async function readVehicleRegistrationOcr(file: File): Promise<VehicleRegistrationResult> {
  const sessionId = randomUUID();

  const fileError = validateVehicleImageFile(file);
  if (fileError) {
    return { success: false, status: 'ERROR', errorCode: fileError, sessionId };
  }

  const cfg = vehicleConfig();
  if (!cfg) {
    return { success: false, status: 'ERROR', errorCode: 'NOT_CONFIGURED', sessionId };
  }

  const outbound = new FormData();
  outbound.append('file', file, file.name || 'vehicle-registration.jpg');
  outbound.append('document_hint', 'vehicle_registration');

  try {
    const response = await fetch(`${cfg.baseUrl}/v1/ocr/read`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${cfg.apiKey}` },
      body: outbound,
      signal: AbortSignal.timeout(60_000),
      redirect: 'manual',
      duplex: 'half',
    } as RequestInit);

    const text = await response.text();
    const trimmed = text.trim();
    if (!trimmed || looksLikeHtml(trimmed)) {
      return { success: false, status: 'ERROR', errorCode: 'OCR_SERVICE_ERROR', sessionId };
    }

    let parsed: RawGeneralOcrResponse | RawGeneralOcrError;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      return { success: false, status: 'ERROR', errorCode: 'OCR_SERVICE_ERROR', sessionId };
    }

    if (!response.ok || parsed.success !== true) {
      return { success: false, status: 'ERROR', errorCode: 'OCR_SERVICE_ERROR', sessionId };
    }

    const fields = mapRawFields(parsed.fields);
    const hasBlockingIssues =
      (fields.plate.value !== null && !fields.plate.validated) || (fields.vin.value !== null && !fields.vin.validated);

    return {
      success: true,
      documentType: 'VEHICLE_REGISTRATION',
      fields,
      validationLevel: fields.plate.validated || fields.vin.validated ? 'FORMAT_VALIDATED' : 'OCR_READ',
      diagnostics: {
        ocrMs: parsed.ocrMs,
        totalMs: parsed.totalMs,
        lineCount: parsed.lines?.length ?? 0,
        hasBlockingIssues,
      },
      sessionId,
    };
  } catch {
    return { success: false, status: 'ERROR', errorCode: 'OCR_SERVICE_ERROR', sessionId };
  }
}
