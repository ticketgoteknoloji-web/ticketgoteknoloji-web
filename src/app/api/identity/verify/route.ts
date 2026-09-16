import { NextResponse } from 'next/server';
import { clientIp, rateLimit } from '@/lib/payments/security';
import {
  forwardIdentityToN8n,
  identityError,
  identityLog,
  mapUpstreamStatus,
  resolveSessionId,
  validateIdentityFile,
} from '@/lib/identity/n8n-verify';
import { isTcIdFrontHint } from '@/lib/identity/parse-tc-id-front';
import { readTcIdFrontViaOcr } from '@/lib/identity/ocr-tc-id-front';
import { warmLocalTcIdOcr } from '@/lib/identity/local-tesseract-ocr';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 180;

// Warm native/JS OCR once per process (first request stays fast).
void warmLocalTcIdOcr().catch(() => undefined);

function json(body: unknown, status: number) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

function resolveDocumentHint(form: FormData): string {
  const raw = form.get('document_hint') ?? form.get('documentHint') ?? 'passport';
  return String(raw ?? 'passport').trim() || 'passport';
}

export async function POST(request: Request) {
  const ip = clientIp(request.headers);
  if (!rateLimit(`identity-verify:${ip}`, 10, 60_000)) {
    return json(identityError('INVALID_INPUT'), 429);
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json(identityError('INVALID_INPUT'), 400);
  }

  const fileValue = form.get('dosya');
  const file = fileValue instanceof File ? fileValue : null;
  const fileError = validateIdentityFile(file);
  if (fileError || !file) {
    const status = fileError === 'PAYLOAD_TOO_LARGE' ? 413 : 400;
    return json(identityError(fileError ?? 'INVALID_INPUT'), status);
  }

  const sessionId = resolveSessionId(form.get('sessionId'));
  const documentHint = resolveDocumentHint(form);

  // T.C. kimlik ÖN YÜZÜ: never call MRZ / n8n — local visual OCR + field parse only.
  if (isTcIdFrontHint(documentHint)) {
    const ocr = await readTcIdFrontViaOcr(file);
    identityLog(sessionId, {
      httpStatus: ocr.ok ? 200 : ocr.httpStatus,
      ms: ocr.ms,
      success: ocr.ok && ('allRequiredValid' in ocr ? ocr.allRequiredValid : false),
      status: !ocr.ok
        ? ocr.errorCode
        : ocr.allRequiredValid
          ? 'TC_ID_FRONT_OK'
          : 'TC_ID_FRONT_PARTIAL',
    });

    if (!ocr.ok) {
      return json(
        identityError(ocr.errorCode === 'NOT_CONFIGURED' ? 'NOT_CONFIGURED' : 'MRZ_SERVICE_ERROR', sessionId),
        ocr.httpStatus,
      );
    }

    return json(
      {
        ad: ocr.fields.ad,
        soyad: ocr.fields.soyad,
        tcKimlikNo: ocr.fields.tcKimlikNo,
        dogumTarihi: ocr.fields.dogumTarihi,
        cinsiyet: ocr.fields.cinsiyet,
        fields: ocr.details,
        fieldStatus: ocr.fieldStatus,
        allRequiredValid: ocr.allRequiredValid,
        cardDetected: ocr.cardDetected,
        perspectiveFixed: ocr.perspectiveFixed,
        cardCropped: ocr.cardCropped,
        labelBasedParsing: false,
        usedRoi: ocr.usedRoi,
        status: ocr.allRequiredValid ? 'TC_ID_FRONT_OK' : 'TC_ID_FRONT_PARTIAL',
      },
      200,
    );
  }

  const result = await forwardIdentityToN8n({
    sessionId,
    file,
    documentHint,
  });

  const payload = result.body && typeof result.body === 'object' ? (result.body as Record<string, unknown>) : {};
  identityLog(sessionId, {
    httpStatus: result.httpStatus,
    ms: result.ms,
    success: payload.success,
    status: payload.status,
  });

  const status = mapUpstreamStatus(result.httpStatus);
  const body =
    result.httpStatus === 401 || result.httpStatus === 403
      ? identityError('MRZ_SERVICE_ERROR', sessionId)
      : result.body;
  return json(body, status);
}
