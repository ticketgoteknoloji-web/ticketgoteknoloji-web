import type { VehicleRegistrationResult } from '../vehicle-registration/types';
import type { DocumentReaderFieldValue, DocumentReaderResult } from './types';

/**
 * EXTERNAL_VERIFIED policy
 * ------------------------
 * The existing identity/verify flow forwards to an n8n webhook
 * (N8N_IDENTITY_VERIFY_BASE_URL) and receives back a `verified` boolean and
 * a `status` string. We do not have visibility into what n8n's workflow
 * actually checks — it could be a genuine external verification, or it
 * could just be re-confirming the same OCR/check-digit result. Because
 * that source cannot be confirmed from this codebase, this adapter NEVER
 * maps n8n's `verified: true` to `EXTERNAL_VERIFIED`. It is intentionally
 * capped at `FORMAT_VALIDATED` (or `OCR_READ` if even that fails).
 *
 * If a future integration point can prove its external verification
 * source, it should set `EXTERNAL_VERIFIED` explicitly and locally at that
 * call site — never as a side effect of passing through this adapter.
 */

// Loosely mirrors MrzVerifyScreen.tsx's internal `VerifyResult` shape,
// declared independently here so this lib module does not import a React
// component file.
export type IdentityVerifyResultLike = {
  success?: boolean;
  verified?: boolean;
  status?: string;
  documentType?: string;
  firstName?: string;
  lastName?: string;
  nationality?: string;
  birthDate?: string;
  gender?: string;
  expiryDate?: string;
  documentNumber?: string;
  ad?: string;
  soyad?: string;
  tcKimlikNo?: string;
  dogumTarihi?: string;
  cinsiyet?: string;
  fields?: Record<string, { value?: string; confidence?: number; valid?: boolean } | undefined>;
  allRequiredValid?: boolean;
};

function field(value: string | null | undefined, confidence: number | null = null): DocumentReaderFieldValue {
  return { value: value && value.length > 0 ? value : null, confidence };
}

export function adaptPassportResult(result: IdentityVerifyResultLike, sessionId?: string): DocumentReaderResult {
  const notes: string[] = [];
  const formatOk = result.success === true && result.allRequiredValid !== false;
  if (!formatOk) notes.push('MRZ/format doğrulaması tamamlanamadı — alanları kontrol edin.');

  return {
    documentType: 'PASSPORT',
    fields: {
      firstName: field(result.firstName),
      lastName: field(result.lastName),
      passportNumber: field(result.documentNumber),
      nationality: field(result.nationality),
      birthDate: field(result.birthDate),
      gender: field(result.gender),
      expiryDate: field(result.expiryDate),
    },
    // Capped at FORMAT_VALIDATED regardless of n8n's `verified` flag — see policy note above.
    validationLevel: formatOk ? 'FORMAT_VALIDATED' : 'OCR_READ',
    validationNotes: notes,
    sessionId,
  };
}

export function adaptNationalIdResult(result: IdentityVerifyResultLike, sessionId?: string): DocumentReaderResult {
  const notes: string[] = [];
  const formatOk = result.success === true && result.allRequiredValid !== false;
  if (!formatOk) notes.push('T.C. Kimlik No algoritmik kontrolü resmi devlet doğrulaması değildir; alanları kontrol edin.');

  const tcField = result.fields?.tcKimlikNo;

  return {
    documentType: 'NATIONAL_ID',
    fields: {
      firstName: field(result.ad ?? result.fields?.ad?.value),
      lastName: field(result.soyad ?? result.fields?.soyad?.value),
      identityNumber: field(result.tcKimlikNo ?? tcField?.value, tcField?.confidence ?? null),
      birthDate: field(result.dogumTarihi ?? result.fields?.dogumTarihi?.value),
      gender: field(result.cinsiyet ?? result.fields?.cinsiyet?.value),
    },
    validationLevel: formatOk ? 'FORMAT_VALIDATED' : 'OCR_READ',
    validationNotes: notes,
    sessionId,
  };
}

export function adaptVehicleRegistrationResult(result: VehicleRegistrationResult): DocumentReaderResult {
  if (!result.success) {
    return {
      documentType: 'VEHICLE_REGISTRATION',
      fields: {},
      validationLevel: 'OCR_READ',
      validationNotes: [`OCR başarısız: ${result.errorCode}`],
      sessionId: result.sessionId,
    };
  }

  const notes: string[] = [];
  if (result.diagnostics.hasBlockingIssues) {
    notes.push('Plaka veya VIN biçim doğrulamasından geçemedi; lütfen alanları kontrol edin.');
  }

  const f = result.fields;
  return {
    documentType: 'VEHICLE_REGISTRATION',
    fields: {
      plate: field(f.plate.value, f.plate.confidence),
      brand: field(f.brand.value, f.brand.confidence),
      model: field(f.model.value, f.model.confidence),
      vehicleType: field(f.vehicleType.value, f.vehicleType.confidence),
      vehicleClass: field(f.vehicleClass.value, f.vehicleClass.confidence),
      modelYear: field(f.modelYear.value, f.modelYear.confidence),
      vin: field(f.vin.value, f.vin.confidence),
      engineNumber: field(f.engineNumber.value, f.engineNumber.confidence),
      fuelType: field(f.fuelType.value, f.fuelType.confidence),
      color: field(f.color.value, f.color.confidence),
      seatCount: field(f.seatCount.value, f.seatCount.confidence),
      firstRegistrationDate: field(f.firstRegistrationDate.value, f.firstRegistrationDate.confidence),
      registrationDate: field(f.registrationDate.value, f.registrationDate.confidence),
      documentSerialNumber: field(f.documentSerialNumber.value, f.documentSerialNumber.confidence),
      ownerName: field(f.ownerName.value, f.ownerName.confidence),
    },
    validationLevel: result.validationLevel,
    validationNotes: notes,
    sessionId: result.sessionId,
  };
}

/** Marks a result as user-confirmed — the only transition this module performs automatically. */
export function markUserConfirmed(result: DocumentReaderResult): DocumentReaderResult {
  return { ...result, validationLevel: 'USER_CONFIRMED' };
}
