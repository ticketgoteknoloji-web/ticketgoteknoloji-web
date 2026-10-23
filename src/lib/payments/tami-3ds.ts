import { hmacEquals, hmacSign } from '@/lib/payments/security';

type StoredHtml = { html: string; expiresAt: number };

const STORE = new Map<string, StoredHtml>();
const TTL_MS = 15 * 60 * 1000;

function key(attemptId: string, orderId: string): string {
  return `${attemptId}:${orderId}`;
}

function prune(now = Date.now()): void {
  for (const [id, item] of STORE) {
    if (item.expiresAt <= now) STORE.delete(id);
  }
}

export function tamiLaunchToken(attemptId: string, orderId: string): string {
  return hmacSign(`tami-3ds:${attemptId}:${orderId}`);
}

export function tamiLaunchTokenOk(attemptId: string, orderId: string, sig: string): boolean {
  return hmacEquals(tamiLaunchToken(attemptId, orderId), sig);
}

export function storeTami3dsHtml(attemptId: string, orderId: string, html: string): void {
  prune();
  STORE.set(key(attemptId, orderId), { html, expiresAt: Date.now() + TTL_MS });
}

export function takeTami3dsHtml(attemptId: string, orderId: string): string | null {
  prune();
  const id = key(attemptId, orderId);
  const item = STORE.get(id);
  if (!item) return null;
  STORE.delete(id);
  return item.html;
}
