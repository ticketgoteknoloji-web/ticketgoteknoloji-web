import { NextResponse } from 'next/server';
import { clientIp, rateLimit } from '@/lib/payments/security';
import { readVehicleRegistrationOcr, validateVehicleImageFile } from '@/lib/vehicle-registration/parse-registration';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function json(body: unknown, status: number) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

function vehicleLog(sessionId: string | undefined, fields: { httpStatus: number; ms: number; success: boolean }): void {
  // Non-sensitive only — never plate, VIN, brand, owner name, or the image itself.
  console.info(
    JSON.stringify({
      event: 'vehicle_registration_scan',
      ts: new Date().toISOString(),
      sessionId,
      httpStatus: fields.httpStatus,
      ms: fields.ms,
      success: fields.success,
    }),
  );
}

export async function POST(request: Request) {
  const t0 = Date.now();
  const ip = clientIp(request.headers);
  if (!rateLimit(`vehicle-registration-scan:${ip}`, 10, 60_000)) {
    return json({ success: false, status: 'ERROR', errorCode: 'INVALID_INPUT' }, 429);
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json({ success: false, status: 'ERROR', errorCode: 'INVALID_INPUT' }, 400);
  }

  const fileValue = form.get('dosya') ?? form.get('file');
  const file = fileValue instanceof File ? fileValue : null;
  const fileError = validateVehicleImageFile(file);
  if (fileError || !file) {
    const status = fileError === 'PAYLOAD_TOO_LARGE' ? 413 : 400;
    vehicleLog(undefined, { httpStatus: status, ms: Date.now() - t0, success: false });
    return json({ success: false, status: 'ERROR', errorCode: fileError ?? 'INVALID_INPUT' }, status);
  }

  const result = await readVehicleRegistrationOcr(file);
  const httpStatus = result.success ? 200 : result.errorCode === 'NOT_CONFIGURED' ? 503 : 502;
  vehicleLog(result.sessionId, { httpStatus, ms: Date.now() - t0, success: result.success });

  return json(result, result.success ? 200 : httpStatus);
}
