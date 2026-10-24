import { createCipheriv, createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from 'crypto';

export function base64UrlEncode(input: Buffer | string): string {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input, 'utf8');
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function base64UrlDecode(value: string): Buffer {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const pad = base64.length % 4 === 2 ? '==' : base64.length % 4 === 3 ? '=' : '';
  return Buffer.from(base64 + pad, 'base64');
}

/**
 * Tami PG-Auth-Token (Java SHA-256 + Base64).
 * Hash input is merchantNumber + terminalNumber + secretKey with no separators.
 * Header value is merchantNumber:terminalNumber:base64Sha256.
 */
export function generatePgAuthToken(
  merchantNumber: string,
  terminalNumber: string,
  secretKey: string
): string {
  const text = String(merchantNumber) + String(terminalNumber) + String(secretKey);
  const hash = createHash('sha256').update(text, 'utf8').digest('base64');
  return `${merchantNumber}:${terminalNumber}:${hash}`;
}

/**
 * Tami installment-inquiry hash (Java SHA-256 + Base64).
 * Hash input is merchantNumber + terminalNumber + secretKey with no separators.
 * Not used for payment auth, 3-D Secure, callback, refund, or cancel.
 */
export function generateTamiInstallmentHash(
  merchantNumber: string,
  terminalNumber: string,
  secretKey: string
): string {
  const text = String(merchantNumber) + String(terminalNumber) + String(secretKey);
  return createHash('sha256').update(text, 'utf8').digest('base64');
}

/**
 * Tami point-inquiry hash (Java SHA-256 + Base64).
 * Hash input is merchantNumber + terminalNumber + secretKey with no separators.
 * Used only by puan sorgulama — not payment auth, 3-D Secure, callback, refund, cancel, or installments.
 */
export function generateTamiPointQueryHash(
  merchantNumber: string,
  terminalNumber: string,
  secretKey: string
): string {
  const text = String(merchantNumber) + String(terminalNumber) + String(secretKey);
  return createHash('sha256').update(text, 'utf8').digest('base64');
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

function canonicalCallbackValue(field: string, value: unknown): string {
  if (field === 'success') {
    if (value === true || value === 1 || value === '1' || value === 'true') return 'true';
    if (value === false || value === 0 || value === '0' || value === 'false') return 'false';
  }
  return value == null ? '' : String(value);
}

export function computeCallbackHash(callback: Record<string, string>, secretKey: string): string {
  const params = callback.hashParams?.trim() ?? '';
  if (!params || !secretKey) return '';
  let data = '';
  for (const field of params.split('+')) {
    const name = field.trim();
    if (!name) continue;
    data += canonicalCallbackValue(name, callback[name]);
  }
  return createHmac('sha256', secretKey).update(data, 'utf8').digest('base64');
}

export function verifyCallbackHash(callback: Record<string, string>, secretKey: string): boolean {
  if (!secretKey || !callback.hashParams?.trim() || !callback.hashedData?.trim()) return false;
  const expected = computeCallbackHash(callback, secretKey);
  const received = callback.hashedData ?? '';
  if (!expected || !received) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(received);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

const TAMI_TOKEN_TTL_SECONDS = 600;
const TAMI_CLOCK_SKEW_SECONDS = 60;

function signHs512(kid: string, k: string, claims: Record<string, unknown>): string {
  const headerJson = JSON.stringify(kid ? { alg: 'HS512', kid, typ: 'JWT' } : { alg: 'HS512', typ: 'JWT' });
  const headerB64 = base64UrlEncode(headerJson);
  const payloadB64 = base64UrlEncode(JSON.stringify(claims));
  const signingInput = `${headerB64}.${payloadB64}`;
  const signature = createHmac('sha512', base64UrlDecode(k)).update(signingInput).digest();
  return `${signingInput}.${base64UrlEncode(signature)}`;
}

function encryptSignedJwt(k: string, jws: string): string {
  const header = base64UrlEncode(JSON.stringify({ alg: 'dir', enc: 'A256GCM', cty: 'JWT' }));
  const encryptionKey = createHash('sha256').update(base64UrlDecode(k)).digest();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey, iv);
  cipher.setAAD(Buffer.from(header, 'ascii'));
  const ciphertext = Buffer.concat([cipher.update(jws, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${header}..${base64UrlEncode(iv)}.${base64UrlEncode(ciphertext)}.${base64UrlEncode(tag)}`;
}

/**
 * Tami v4 signedRequest.
 * https://dev.tami.com.tr/istek-tokeni-olusturma
 * HS512 JWS, then dir + A256GCM. Encryption key is SHA-256 of the decoded JWK k.
 */
export function createTamiSignedRequest(input: {
  kid: string;
  k: string;
  merchantNumber: string;
  terminalNumber: string;
  body: Record<string, unknown>;
}): string {
  const now = Math.floor(Date.now() / 1000);
  const claims = {
    iss: `${input.merchantNumber}:${input.terminalNumber}`,
    aud: 'tami',
    jti: randomUUID(),
    iat: now,
    nbf: now,
    exp: now + TAMI_TOKEN_TTL_SECONDS,
    'tami:body': input.body,
    'tami:apiVersion': 'v4',
  };
  return encryptSignedJwt(input.k, signHs512(input.kid, input.k, claims));
}

/** Test and local fixture helper. Production responses are created by Tami. */
export function signTamiResponse(input: {
  kid: string;
  k: string;
  merchantNumber: string;
  terminalNumber: string;
  body: Record<string, unknown>;
}): string {
  const now = Math.floor(Date.now() / 1000);
  return signHs512(input.kid, input.k, {
    iss: 'tami',
    aud: `${input.merchantNumber}:${input.terminalNumber}`,
    jti: randomUUID(),
    iat: now,
    nbf: now,
    exp: now + TAMI_TOKEN_TTL_SECONDS,
    'tami:body': input.body,
    'tami:apiVersion': 'v4',
  });
}

function jwtNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/**
 * Tami v4 signedResponse.
 * https://dev.tami.com.tr/cevap-tokeni-cozumleme
 * Successful sandbox orderQuery responses are three-part HS512 JWTs.
 * Five-part tokens are rejected. Operation pages describe the same field as
 * encrypted, but their examples are truncated and the live success token is a JWT.
 * Signature, audience, issuer and tami:apiVersion are required.
 */
export function readTamiSignedResponse(
  token: string,
  k: string,
  merchantNumber: string,
  terminalNumber: string
): Record<string, unknown> | null {
  const parts = token.split('.');
  if (parts.length !== 3 || !k) return null;
  const [headerB64, payloadB64, signatureB64] = parts;
  let header: Record<string, unknown>;
  let claims: Record<string, unknown>;
  try {
    header = JSON.parse(base64UrlDecode(headerB64).toString('utf8')) as Record<string, unknown>;
    claims = JSON.parse(base64UrlDecode(payloadB64).toString('utf8')) as Record<string, unknown>;
  } catch {
    return null;
  }
  if (header.alg !== 'HS512' || header.typ !== 'JWT') return null;
  const expected = createHmac('sha512', base64UrlDecode(k)).update(`${headerB64}.${payloadB64}`).digest();
  const received = base64UrlDecode(signatureB64);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;
  if (claims.iss !== 'tami') return null;
  if (claims.aud !== `${merchantNumber}:${terminalNumber}`) return null;
  if (claims['tami:apiVersion'] !== 'v4') return null;
  const now = Math.floor(Date.now() / 1000);
  const exp = jwtNumber(claims.exp);
  const nbf = jwtNumber(claims.nbf);
  if (exp == null || now > exp + TAMI_CLOCK_SKEW_SECONDS) return null;
  if (nbf != null && now + TAMI_CLOCK_SKEW_SECONDS < nbf) return null;
  const body = claims['tami:body'];
  if (body && typeof body === 'object' && !Array.isArray(body)) return body as Record<string, unknown>;
  if (typeof body === 'string') {
    try {
      const parsed = JSON.parse(body) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
    } catch {
      return null;
    }
  }
  return null;
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
