/**
 * Vehicle Registration (Araç Ruhsatı) — result types.
 *
 * Mirrors the value/originalValue/confidence/validated shape requested for
 * every field, adapted to this repo's existing TypeScript conventions
 * (see src/lib/identity/parse-tc-id-front.ts for the sibling pattern used
 * on the T.C. kimlik ön yüz side).
 */

export type VehicleFieldStatus = 'valid' | 'invalid' | 'unvalidated' | 'missing';

export type VehicleField = {
  /** Final value shown to the user (after normalization). Null if never read. */
  value: string | null;
  /** Exact OCR text before any normalization/correction — never discarded. */
  originalValue: string | null;
  /** 0..1 confidence, when the source can produce one. */
  confidence: number | null;
  /** Whether `value` passed this field's own format validation (not an official check). */
  validated: boolean;
  status: VehicleFieldStatus;
};

export type VehicleRegistrationFieldsResult = {
  plate: VehicleField;
  brand: VehicleField;
  model: VehicleField;
  vehicleType: VehicleField;
  vehicleClass: VehicleField;
  modelYear: VehicleField;
  vin: VehicleField;
  engineNumber: VehicleField;
  fuelType: VehicleField;
  color: VehicleField;
  seatCount: VehicleField;
  firstRegistrationDate: VehicleField;
  registrationDate: VehicleField;
  documentSerialNumber: VehicleField;
  ownerName: VehicleField;
};

export type VehicleRegistrationResult =
  | {
      success: true;
      documentType: 'VEHICLE_REGISTRATION';
      fields: VehicleRegistrationFieldsResult;
      /** OCR_READ | FORMAT_VALIDATED | USER_CONFIRMED — see verification-level notes in adapter.ts. */
      validationLevel: 'OCR_READ' | 'FORMAT_VALIDATED';
      /** Non-sensitive diagnostics only — never the raw document image or full raw text by default. */
      diagnostics: {
        ocrMs: number;
        totalMs: number;
        lineCount: number;
        hasBlockingIssues: boolean;
      };
      sessionId: string;
    }
  | {
      success: false;
      status: 'ERROR';
      errorCode: 'INVALID_INPUT' | 'NOT_CONFIGURED' | 'OCR_SERVICE_ERROR' | 'PAYLOAD_TOO_LARGE';
      sessionId?: string;
    };

/** Raw shape returned by the Python service's VehicleRegistrationFields Pydantic model. */
export type RawVehicleRegistrationFields = {
  plate: string | null;
  vehicleType: string | null;
  vehicleClass: string | null;
  brand: string | null;
  model: string | null;
  modelYear: string | null;
  vin: string | null;
  engineNumber: string | null;
  fuelType: string | null;
  color: string | null;
  seatCount: string | null;
  firstRegistrationDate: string | null;
  registrationDate: string | null;
  ownerName: string | null;
  documentNumber: string | null;
};

/** Raw shape returned by the Python service's /v1/ocr/read (GeneralOcrSuccessResponse). */
export type RawGeneralOcrResponse = {
  success: true;
  documentType: string;
  rawText: string;
  lines: Array<{ text: string; confidence: number; boundingBox: number[][] }>;
  fields: RawVehicleRegistrationFields;
  ocrMs: number;
  totalMs: number;
};

export type RawGeneralOcrError = {
  success: false;
  error: string;
  message: string;
};
