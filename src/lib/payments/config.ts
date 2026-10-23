import { randomBytes } from 'crypto';
import {
  getPaymentConfig,
  hasUsableTamiPosId,
  isUsableTamiCredential,
  paymentEnv,
  publicSiteUrl,
  qnbpayConfig,
  resolveTamiPosId,
  tamiConfig,
} from '@/config/payment';
import { BRAND_SITE_URL } from '@/lib/site';
import type { PaymentProviderId } from '@/lib/payments/types';

export {
  getPaymentConfig,
  hasUsableTamiPosId,
  isUsableTamiCredential,
  paymentEnv,
  publicSiteUrl,
  qnbpayConfig,
  resolveTamiPosId,
  tamiConfig,
};

/** Tami is ready only when merchant, POS, secret, kid and k are all real, non-placeholder values. */
export function isTamiReady(): boolean {
  const cfg = tamiConfig();
  return Boolean(
    cfg.configured &&
      isUsableTamiCredential(cfg.merchantId) &&
      hasUsableTamiPosId(cfg.posId, cfg.merchantId) &&
      isUsableTamiCredential(cfg.secretKey) &&
      isUsableTamiCredential(cfg.kid) &&
      isUsableTamiCredential(cfg.k)
  );
}

export function publicBaseUrl(request?: Request): string {
  const paymentBase = process.env.PAYMENT_PUBLIC_BASE_URL?.trim();
  if (paymentBase) return paymentBase.replace(/\/$/, '');
  if (paymentEnv() === 'production') return publicSiteUrl() || BRAND_SITE_URL;
  const origin = request?.headers.get('origin')?.replace(/\/$/, '');
  if (origin && isSafeDevOrigin(origin)) return origin;
  const referer = request?.headers.get('referer');
  if (referer) {
    try {
      const url = new URL(referer);
      const value = url.origin;
      if (isSafeDevOrigin(value)) return value;
    } catch {
      /* ignore */
    }
  }
  return publicSiteUrl();
}

function isSafeDevOrigin(value: string): boolean {
  try {
    const url = new URL(value);
    const host = url.hostname;
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
    if (host === 'localhost' || host === '127.0.0.1') return true;
    return /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(host);
  } catch {
    return false;
  }
}

export function isProviderConfigured(id: PaymentProviderId): boolean {
  if (id === 'tami') return isTamiReady();
  if (id === 'qnbpay') return qnbpayConfig().configured;
  return false;
}

export function isProviderEnabled(id: PaymentProviderId): boolean {
  if (id === 'tami') return getPaymentConfig().tami.enabled;
  if (id === 'qnbpay') return getPaymentConfig().qnbpay.enabled;
  return false;
}

export function newIdempotencyKey(): string {
  return randomBytes(16).toString('hex');
}
