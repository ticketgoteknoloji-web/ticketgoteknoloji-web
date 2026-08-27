import { createHash, createHmac, timingSafeEqual } from 'crypto';

export function base64UrlEncode(input: Buffer | string): string {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input, 'utf8');
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function base64UrlDecode(value: string): Buffer {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const pad = base64.length % 4 === 2 ? '==' : base64.length % 4 === 3 ? '=' : '';
  return Buffer.from(base64 + pad, 'base64');
}

/** PG-Auth-Token: merchantId:merchantUser:base64(sha256(merchantId + merchantUser + secretKey)) */
export function generatePgAuthToken(merchantId: string, merchantUser: string, secretKey: string): string {
  const digest = createHash('sha256').update(`${merchantId}${merchantUser}${secretKey}`, 'utf8').digest();
  return `${merchantId}:${merchantUser}:${digest.toString('base64')}`;
}

export function parseKidAndK(password: string, username = ''): { kid: string; k: string } {
  const trimmed = password.trim();
  const pipe = trimmed.indexOf('|');
  if (pipe >= 0) {
    return {
      kid: trimmed.slice(0, pipe).trim() || username.trim(),
      k: trimmed.slice(pipe + 1).trim(),
    };
  }
  return { kid: username.trim() || trimmed, k: trimmed };
}

/** JWS compact HS512 over the request body JSON (without securityHash). */
export function generateJwkSignature(kid: string, kValue: string, requestBody: Record<string, unknown>): string {
  const bodyJson = JSON.stringify(requestBody);
  const headerJson = JSON.stringify({ alg: 'HS512', typ: 'JWT', kid });
  const headerB64 = base64UrlEncode(headerJson);
  const payloadB64 = base64UrlEncode(bodyJson);
  const signingInput = `${headerB64}.${payloadB64}`;
  const key = base64UrlDecode(kValue);
  const signature = createHmac('sha512', key).update(signingInput).digest();
  return `${signingInput}.${base64UrlEncode(signature)}`;
}

function canonicalCallbackValue(field: string, value: unknown): string {
  if (field === 'success') {
    if (value === true || value === 1 || value === '1' || value === 'true') return 'true';
    if (value === false || value === 0 || value === '0' || value === 'false') return 'false';
  }
  return value == null ? '' : String(value);
}

export function computeCallbackHash(callback: Record<string, string>, secretKey: string): string {
  const params =
    callback.hashParams ||
    'cardOrganization+cardBrand+cardType+maskedNumber+installmentCount+currencyCode+txnAmount+orderId+systemTime+success';
  let data = '';
  for (const field of params.split('+')) {
    const name = field.trim();
    if (!name) continue;
    data += canonicalCallbackValue(name, callback[name]);
  }
  return createHmac('sha256', secretKey).update(data, 'utf8').digest('base64');
}

export function verifyCallbackHash(callback: Record<string, string>, secretKey: string): boolean {
  const expected = computeCallbackHash(callback, secretKey);
  const received = callback.hashedData ?? '';
  if (!expected || !received) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(received);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function isTami3dsSuccess(payload: Record<string, string>): boolean {
  const md = String(payload.mdStatus ?? '');
  const success = payload.success;
  const ok = success === '1' || success === 'true' || success === 'TRUE';
  return md === '1' && ok;
}

export function tamiOrderId(orderNumber: string): string {
  const cleaned = orderNumber.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 36);
  return cleaned.length >= 2 ? cleaned : `TG${cleaned}`.padEnd(2, '0');
}
