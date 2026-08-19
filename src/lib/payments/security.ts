import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { paymentEnv, publicBaseUrl } from '@/lib/payments/config';
import { BRAND_SITE_URL } from '@/lib/site';

const hits = new Map<string, number[]>();

export function clientIp(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]?.trim() || '0.0.0.0';
  return headers.get('x-real-ip')?.trim() || '0.0.0.0';
}

export function allowedOrigins(request?: Request): string[] {
  const extras = (process.env.PAYMENT_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  return [publicBaseUrl(request), BRAND_SITE_URL, ...extras];
}

function isLocalDevOrigin(value: string): boolean {
  try {
    const url = new URL(value);
    const host = url.hostname;
    if (host === 'localhost' || host === '127.0.0.1') return true;
    return paymentEnv() !== 'production' && /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(host);
  } catch {
    return false;
  }
}

export function originAllowed(headers: Headers): boolean {
  const origin = headers.get('origin');
  const referer = headers.get('referer');
  const allowed = allowedOrigins();
  const matches = (value: string) =>
    allowed.some((item) => value === item || value.startsWith(`${item}/`)) || isLocalDevOrigin(value);

  if (origin) return matches(origin);
  if (referer) return matches(referer);
  return paymentEnv() !== 'production';
}

export function rateLimit(key: string, limit = 8, windowMs = 60_000): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((time) => now - time < windowMs);
  recent.push(now);
  hits.set(key, recent);
  return recent.length <= limit;
}

export function sanitizeLogValue(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  if (/iyzico|secret|api[_-]?key|authorization|cvv|cvc|card/i.test(value) && value.length > 12) {
    return '[redacted]';
  }
  return value;
}

export function paymentLog(event: string, fields: Record<string, unknown>): void {
  const safe: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (/secret|authorization|card|cvv|cvc|pan|password|storekey|store_key|userpass|apiKey|api_key|appSecret/i.test(key) && key !== 'orderNumber') {
      safe[key] = '[redacted]';
    } else {
      safe[key] = sanitizeLogValue(value);
    }
  }
  console.info(JSON.stringify({ event, ts: new Date().toISOString(), ...safe }));
}

export function hmacSign(value: string): string {
  const secret = process.env.PAYMENT_SIGNING_SECRET?.trim();
  if (!secret) {
    if (paymentEnv() === 'production') {
      throw new Error('PAYMENT_SIGNING_SECRET is required in production');
    }
    return createHmac('sha256', 'dev-only-signing').update(value).digest('hex');
  }
  return createHmac('sha256', secret).update(value).digest('hex');
}

export function hmacEquals(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function randomToken(): string {
  return randomBytes(18).toString('hex');
}

export function stripCardFields(payload: Record<string, unknown>): Record<string, unknown> {
  const blocked = /^(cc_|card|cvv|cvc|pan|expiry|expire|kart)/i;
  const next: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (blocked.test(key) || key.toLowerCase() === 'cc_no') continue;
    next[key] = value;
  }
  return next;
}

export function timingSafeToken(expected: string, provided: string): boolean {
  if (!expected || !provided) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(provided);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
