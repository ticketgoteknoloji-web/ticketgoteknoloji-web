/**
 * Common document-reader result model.
 *
 * This is purely an ADAPTER-side abstraction: it does not change what the
 * existing `/api/identity/verify` route or the Python MRZ service return.
 * Those response contracts are untouched. `adapter.ts` converts their
 * existing shapes into this common shape for UI/callback consumption.
 */

export type DocumentReaderDocumentType = 'PASSPORT' | 'NATIONAL_ID' | 'VEHICLE_REGISTRATION';

/**
 * OCR_READ:          text was extracted, nothing validated yet.
 * FORMAT_VALIDATED:  passed an algorithmic/format check (MRZ check-digit,
 *                     TC kimlik no checksum, plate/VIN charset) — NOT an
 *                     official government identity verification.
 * USER_CONFIRMED:    the person reviewed and confirmed the fields on screen.
 * EXTERNAL_VERIFIED: a genuinely independent external source verified the
 *                     document. This level is intentionally never assigned
 *                     automatically by this adapter — see note in adapter.ts.
 */
export type DocumentReaderValidationLevel = 'OCR_READ' | 'FORMAT_VALIDATED' | 'USER_CONFIRMED' | 'EXTERNAL_VERIFIED';

export type DocumentReaderFieldValue = {
  value: string | null;
  confidence: number | null;
};

export type DocumentReaderResult = {
  documentType: DocumentReaderDocumentType;
  fields: Record<string, DocumentReaderFieldValue>;
  validationLevel: DocumentReaderValidationLevel;
  validationNotes: string[];
  sessionId?: string;
  /** Present only when explicitly requested by the caller — never included by default. */
  raw?: unknown;
};

/** Shared confirmation callback shape used across all three document flows. */
export type OnDocumentConfirmed = (result: DocumentReaderResult) => void;
