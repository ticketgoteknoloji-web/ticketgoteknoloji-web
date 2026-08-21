import { createHmac, timingSafeEqual } from 'crypto';
import { cookies } from 'next/headers';
import { paymentEnv } from '@/lib/payments/config';
import { rateLimit } from '@/lib/payments/security';
import {
  DOWNLOAD_ACCESS_COOKIE,
  DOWNLOAD_ADMIN_CODE_MAX_LENGTH,
  DOWNLOAD_ADMIN_COOKIE,
  downloadSessionSecretCandidates,
  expectedAdminCodeHash,
  verifyDownloadAdminCode,
} from '@/lib/downloads/config';

const ADMIN_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours
const ACCESS_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export const DOWNLOAD_ADMIN_ROLE = 'download-admin' as const;

function signingSecret(): string {
  const secret = downloadSessionSecretCandidates()[0];
  if (!secret) {
    if (paymentEnv() === 'production') {
      throw new Error('DOWNLOAD_ADMIN_SESSION_SECRET or DOWNLOAD_SESSION_SECRET required');
    }
    return 'dev-only-download-session';
  }
  return secret;
}

function sign(payload: string): string {
  return createHmac('sha256', signingSecret()).update(payload).digest('hex');
}

function safeEqualHex(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export type AdminSession = {
  role: typeof DOWNLOAD_ADMIN_ROLE;
  exp: number;
};

/** Fail-closed when hash missing or code invalid. Never logs the code. */
export function authenticateAdminCode(code: string): boolean {
  if (typeof code !== 'string') return false;
  if (!code || code.length > DOWNLOAD_ADMIN_CODE_MAX_LENGTH) return false;
  const expectedHash = expectedAdminCodeHash();
  if (!expectedHash) return false;
  return verifyDownloadAdminCode(code, expectedHash);
}

export function adminLoginAllowed(ip: string): boolean {
  return rateLimit(`download-admin-login:${ip}`, 5, 15 * 60_000);
}

export function encodeAdminSession(): string {
  const exp = Date.now() + ADMIN_TTL_MS;
  const body = Buffer.from(
    JSON.stringify({ role: DOWNLOAD_ADMIN_ROLE, exp } satisfies AdminSession),
    'utf8'
  ).toString('base64url');
  return `${body}.${sign(body)}`;
}

export function decodeAdminSession(raw: string | undefined | null): AdminSession | null {
  if (!raw) return null;
  const [body, sig] = raw.split('.');
  if (!body || !sig || !safeEqualHex(sign(body), sig)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as Partial<AdminSession>;
    if (parsed?.role !== DOWNLOAD_ADMIN_ROLE || typeof parsed.exp !== 'number') return null;
    if (parsed.exp < Date.now()) return null;
    return { role: DOWNLOAD_ADMIN_ROLE, exp: parsed.exp };
  } catch {
    return null;
  }
}

export async function readAdminSession(): Promise<AdminSession | null> {
  const jar = await cookies();
  return decodeAdminSession(jar.get(DOWNLOAD_ADMIN_COOKIE)?.value);
}

export function adminCookieOptions(maxAgeSec: number) {
  return {
    httpOnly: true,
    secure: paymentEnv() === 'production',
    sameSite: 'strict' as const,
    path: '/',
    maxAge: maxAgeSec,
  };
}

export type AccessCookiePayload = {
  tokens: string[];
  exp: number;
};

export function encodeAccessCookie(tokens: string[]): string {
  const unique = Array.from(new Set(tokens.filter(Boolean))).slice(-20);
  const exp = Date.now() + ACCESS_TTL_MS;
  const body = Buffer.from(JSON.stringify({ tokens: unique, exp } satisfies AccessCookiePayload), 'utf8').toString(
    'base64url'
  );
  return `${body}.${sign(body)}`;
}

export function decodeAccessCookie(raw: string | undefined | null): string[] {
  if (!raw) return [];
  const [body, sig] = raw.split('.');
  if (!body || !sig || !safeEqualHex(sign(body), sig)) return [];
  try {
    const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as AccessCookiePayload;
    if (!parsed || parsed.exp < Date.now() || !Array.isArray(parsed.tokens)) return [];
    return parsed.tokens.filter((t) => typeof t === 'string' && t.length > 8);
  } catch {
    return [];
  }
}

export async function readAccessTokens(): Promise<string[]> {
  const jar = await cookies();
  return decodeAccessCookie(jar.get(DOWNLOAD_ACCESS_COOKIE)?.value);
}

export function mergeAccessTokens(existingRaw: string | undefined, statusToken: string): string {
  const current = decodeAccessCookie(existingRaw);
  return encodeAccessCookie([...current, statusToken]);
}

export { DOWNLOAD_ADMIN_COOKIE, DOWNLOAD_ACCESS_COOKIE, ADMIN_TTL_MS };
