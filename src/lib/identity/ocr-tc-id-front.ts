import 'server-only';

import {
  parseTcIdFrontLayout,
  type TcIdFrontConfidence,
  type TcIdFrontFieldDetails,
  type TcIdFrontFields,
  type TcIdFrontFieldStatus,
} from '@/lib/identity/parse-tc-id-front';
import { recognizeTcIdFrontLocal } from '@/lib/identity/local-tesseract-ocr';

export type TcIdFrontOcrResult =
  | {
      ok: true;
      fields: TcIdFrontFields;
      details: TcIdFrontFieldDetails;
      fieldStatus: TcIdFrontFieldStatus;
      confidence: TcIdFrontConfidence;
      allRequiredValid: boolean;
      ms: number;
      engine: 'native+js' | 'tesseract.js';
      cardDetected: boolean;
      perspectiveFixed: boolean;
      cardCropped: boolean;
      labelBasedParsing: boolean;
      usedRoi: {
        tc: boolean;
        soyad: boolean;
        ad: boolean;
        dob: boolean;
        gender: boolean;
      };
      debugDir: string;
    }
  | {
      ok: false;
      httpStatus: number;
      errorCode: 'NOT_CONFIGURED' | 'OCR_FAILED' | 'MRZ_SERVICE_ERROR';
      ms: number;
    };

/**
 * T.C. kimlik ÖN YÜZ — local ROI OCR only (no MRZ / n8n / full-page field guessing).
 */
export async function readTcIdFrontViaOcr(file: File): Promise<TcIdFrontOcrResult> {
  const t0 = Date.now();
  try {
    const bytes = Buffer.from(await file.arrayBuffer());
    if (!bytes.length) {
      return { ok: false, httpStatus: 400, errorCode: 'OCR_FAILED', ms: 0 };
    }

    const ocr = await recognizeTcIdFrontLocal(bytes);
    const parsed = parseTcIdFrontLayout({
      fieldRois: ocr.fieldRois,
    });

    console.log(
      JSON.stringify({
        CARD_DETECTION_OK: ocr.meta.cardDetected || ocr.meta.areaRatio >= 0.92,
        CARD_WARP_OK: ocr.meta.perspectiveFixed && ocr.meta.width === 1000,
        TC_ROI: ocr.fieldRois.find((r) => r.key === 'tcNo'),
        SURNAME_ROI: ocr.fieldRois.find((r) => r.key === 'soyad'),
        NAME_ROI: ocr.fieldRois.find((r) => r.key === 'ad'),
        DOB_ROI: ocr.fieldRois.find((r) => r.key === 'dogumTarihi'),
        GENDER_ROI: ocr.fieldRois.find((r) => r.key === 'cinsiyet'),
        details: parsed.details,
        debugDir: ocr.debugDir,
      }),
    );

    return {
      ok: true,
      fields: parsed.fields,
      details: parsed.details,
      fieldStatus: parsed.fieldStatus,
      confidence: parsed.confidence,
      allRequiredValid: parsed.allRequiredValid,
      ms: Date.now() - t0,
      engine: ocr.engine,
      cardDetected: ocr.meta.cardDetected || ocr.meta.areaRatio >= 0.92,
      perspectiveFixed: ocr.meta.perspectiveFixed,
      cardCropped: ocr.meta.cardCropped,
      labelBasedParsing: false,
      usedRoi: parsed.usedRoi,
      debugDir: ocr.debugDir,
    };
  } catch {
    return { ok: false, httpStatus: 502, errorCode: 'OCR_FAILED', ms: Date.now() - t0 };
  }
}
