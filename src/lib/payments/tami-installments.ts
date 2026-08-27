import { randomBytes } from 'crypto';
import { tamiConfig } from '@/lib/payments/config';
import { paymentLog } from '@/lib/payments/security';
import { generateTamiInstallmentHash } from '@/lib/payments/tami-crypto';

/** TicketGo public BIN slice for /api/payments/tami/installments. Tami upstream BIN length is unconfirmed. */
export const TAMI_CHECKOUT_BIN_LENGTH = 6;

/** Set only after Tami documents the installment-inquiry HTTP API. */
export const TAMI_INSTALLMENT_ENDPOINT: string | null = null;

const CACHE_TTL_MS = 10 * 60 * 1000;

export type TamiInstallmentOption = {
  count: number;
  enabled: boolean;
};

export type TamiInstallmentQuote = {
  success: boolean;
  cardFamily: string | null;
  installments: TamiInstallmentOption[];
  fallback: boolean;
  message?: string;
};

type CacheEntry = {
  expiresAt: number;
  quote: TamiInstallmentQuote;
};

const cache = new Map<string, CacheEntry>();

export function maskTamiBin(bin: string): string {
  const digits = bin.replace(/\D/g, '');
  if (digits.length < 2) return '****';
  return `${digits.slice(0, 2)}${'*'.repeat(Math.max(0, digits.length - 2))}`;
}

export function normalizeTamiCheckoutBin(raw: string): string | null {
  const digits = String(raw ?? '').replace(/\D/g, '');
  if (digits.length < TAMI_CHECKOUT_BIN_LENGTH) return null;
  return digits.slice(0, TAMI_CHECKOUT_BIN_LENGTH);
}

function fallbackQuote(message: string): TamiInstallmentQuote {
  return {
    success: true,
    cardFamily: null,
    installments: [{ count: 1, enabled: true }],
    fallback: true,
    message,
  };
}

function readCache(bin: string): TamiInstallmentQuote | null {
  const hit = cache.get(bin);
  if (!hit) return null;
  if (hit.expiresAt <= Date.now()) {
    cache.delete(bin);
    return null;
  }
  return hit.quote;
}

function writeCache(bin: string, quote: TamiInstallmentQuote): void {
  cache.set(bin, { expiresAt: Date.now() + CACHE_TTL_MS, quote });
}

/**
 * Server-side Tami installment inquiry.
 * Upstream endpoint, method, body, headers, and response schema are not confirmed — do not guess.
 */
export async function queryTamiInstallments(rawBin: string): Promise<TamiInstallmentQuote> {
  const bin = normalizeTamiCheckoutBin(rawBin);
  if (!bin) {
    return {
      success: false,
      cardFamily: null,
      installments: [{ count: 1, enabled: true }],
      fallback: true,
      message: 'Kart programı için BIN bilgisi gerekli.',
    };
  }

  const cached = readCache(bin);
  if (cached) {
    paymentLog('tami_installments_cache', {
      bin: maskTamiBin(bin),
      success: cached.success,
      installmentCounts: cached.installments.filter((item) => item.enabled).map((item) => item.count),
    });
    return cached;
  }

  const cfg = tamiConfig();
  const correlationId = `Correlation${randomBytes(16).toString('hex')}`;
  const installmentHash = cfg.configured
    ? generateTamiInstallmentHash(cfg.merchantId, cfg.posId, cfg.secretKey)
    : '';

  if (!installmentHash && cfg.configured) {
    const quote = fallbackQuote('Taksit seçenekleri şu anda alınamadı. Ödeme tek çekim olarak devam eder.');
    paymentLog('tami_installments_failed', { bin: maskTamiBin(bin), success: false, correlationId, reason: 'hash_failed' });
    return quote;
  }

  if (!TAMI_INSTALLMENT_ENDPOINT) {
    const quote = fallbackQuote('Taksit seçenekleri şu anda alınamadı. Ödeme tek çekim olarak devam eder.');
    writeCache(bin, quote);
    paymentLog('tami_installments_unavailable', {
      bin: maskTamiBin(bin),
      success: true,
      installmentCounts: [1],
      correlationId,
      reason: 'endpoint_unspecified',
    });
    return quote;
  }

  // Confirmed Tami installment HTTP API is not in this repository. Do not invent path or payload.
  const quote = fallbackQuote('Taksit seçenekleri şu anda alınamadı. Ödeme tek çekim olarak devam eder.');
  paymentLog('tami_installments_unavailable', {
    bin: maskTamiBin(bin),
    success: true,
    installmentCounts: [1],
    correlationId,
    reason: 'endpoint_unspecified',
  });
  return quote;
}
