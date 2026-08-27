import { createHash, randomBytes } from 'crypto';
import { tamiConfig } from '@/lib/payments/config';
import { paymentLog } from '@/lib/payments/security';
import { generateTamiPointQueryHash } from '@/lib/payments/tami-crypto';

/** Set only after Tami documents the point-inquiry HTTP API. Do not invent a path. */
export const TAMI_POINT_QUERY_ENDPOINT: string | null = null;

const RATE_WINDOW_MS = 60_000;
const RATE_LIMIT = 8;
const REPEAT_COOLDOWN_MS = 15_000;

export type TamiPointQuote = {
  ok: boolean;
  available: boolean;
  amountMinor: number | null;
  amountLabel: string | null;
  redeemable: boolean;
  message: string;
};

const ipHits = new Map<string, number[]>();
const ipCooldown = new Map<string, number>();

function hashIp(ip: string): string {
  return createHash('sha256').update(`tami-points:${ip}`, 'utf8').digest('hex').slice(0, 16);
}

function allowIp(ip: string): boolean {
  const key = hashIp(ip);
  const now = Date.now();
  const recent = (ipHits.get(key) ?? []).filter((time) => now - time < RATE_WINDOW_MS);
  recent.push(now);
  ipHits.set(key, recent);
  return recent.length <= RATE_LIMIT;
}

function inCooldown(ip: string): boolean {
  const key = hashIp(ip);
  const until = ipCooldown.get(key) ?? 0;
  return until > Date.now();
}

function markCooldown(ip: string): void {
  ipCooldown.set(hashIp(ip), Date.now() + REPEAT_COOLDOWN_MS);
}

function unavailable(message: string): TamiPointQuote {
  return {
    ok: false,
    available: false,
    amountMinor: null,
    amountLabel: null,
    redeemable: false,
    message,
  };
}

function requestHasCardMaterial(body: Record<string, unknown>): boolean {
  const keys = Object.keys(body);
  return keys.some((key) =>
    /^(card|pan|cvv|cvc|number|expiry|expire|cc_|holder)/i.test(key)
  );
}

/**
 * Server-side Tami puan sorgulama.
 * Upstream endpoint, method, body, headers, BIN vs PAN, and response schema are not confirmed.
 */
export async function queryTamiPoints(input: {
  ip: string;
  body: Record<string, unknown>;
}): Promise<TamiPointQuote> {
  const correlationId = `Correlation${randomBytes(16).toString('hex')}`;

  if (requestHasCardMaterial(input.body)) {
    paymentLog('tami_points_rejected', {
      success: false,
      correlationId,
      reason: 'card_material_not_accepted',
    });
    return unavailable('Puan sorgulama için kart verisi kabul edilmiyor.');
  }

  if (!allowIp(input.ip)) {
    paymentLog('tami_points_rate_limited', { success: false, correlationId });
    return unavailable('Çok fazla deneme. Lütfen sonra tekrar deneyin.');
  }

  if (inCooldown(input.ip)) {
    paymentLog('tami_points_cooldown', { success: false, correlationId });
    return unavailable('Puan sorgulama kısa süre önce yapıldı.');
  }
  markCooldown(input.ip);

  const cfg = tamiConfig();
  if (!cfg.configured) {
    paymentLog('tami_points_unavailable', {
      success: false,
      correlationId,
      reason: 'not_configured',
    });
    return unavailable('Puan bilgisi şu anda alınamıyor.');
  }

  const pointHash = generateTamiPointQueryHash(cfg.merchantId, cfg.posId, cfg.secretKey);
  if (!pointHash) {
    paymentLog('tami_points_failed', { success: false, correlationId, reason: 'hash_failed' });
    return unavailable('Puan bilgisi şu anda alınamıyor.');
  }

  if (!TAMI_POINT_QUERY_ENDPOINT) {
    paymentLog('tami_points_unavailable', {
      success: false,
      correlationId,
      reason: 'endpoint_unspecified',
    });
    return unavailable('Tami puan sorgulama endpoint/payload dokümanı gerekli.');
  }

  // Confirmed Tami point-inquiry HTTP API is not in this repository. Do not invent path or payload.
  paymentLog('tami_points_unavailable', {
    success: false,
    correlationId,
    reason: 'endpoint_unspecified',
  });
  return unavailable('Tami puan sorgulama endpoint/payload dokümanı gerekli.');
}
