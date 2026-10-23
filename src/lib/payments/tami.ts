import { randomBytes } from 'crypto';
import { fromMinorUnits } from '@/lib/money';
import { providerAmountMatches } from '@/lib/payments/amount';
import { tamiChargeMinor } from '@/lib/payments/charge';
import { hasUsableTamiPosId, isTamiReady, tamiConfig } from '@/lib/payments/config';
import { paymentLog } from '@/lib/payments/security';
import {
  generateJwkSignature,
  generatePgAuthToken,
  isTami3dsSuccess,
  tamiOrderId,
  verifyCallbackHash,
} from '@/lib/payments/tami-crypto';
import type {
  CreatePaymentInput,
  CreatePaymentResult,
  PaymentCard,
  PaymentProvider,
  VerifyPaymentInput,
  VerifyPaymentResult,
} from '@/lib/payments/types';

type TamiJson = Record<string, unknown>;

function isRecord(value: unknown): value is TamiJson {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asString(value: unknown): string {
  return value == null ? '' : String(value);
}

function digits(value: string): string {
  return value.replace(/\D/g, '');
}

function expiryYear(value: string): string {
  const raw = digits(value);
  if (raw.length === 2) return `20${raw}`;
  return raw.slice(0, 4);
}

function expiryMonth(value: string): string {
  return digits(value).padStart(2, '0').slice(-2);
}

function present(value: unknown): 'present' | 'missing' {
  if (value == null) return 'missing';
  if (typeof value === 'string') return value.trim() ? 'present' : 'missing';
  if (typeof value === 'object') return 'present';
  return 'present';
}

function describeTamiPayloadShape(payload: Record<string, unknown>) {
  return {
    amount: typeof payload.amount,
    orderId: typeof payload.orderId,
    currency: typeof payload.currency,
    installmentCount: typeof payload.installmentCount,
    paymentGroup: typeof payload.paymentGroup,
    card: present(payload.card),
    buyer: present(payload.buyer),
    billingAddress: present(payload.billingAddress),
    shippingAddress: present(payload.shippingAddress),
    callbackUrl: present(payload.callbackUrl),
    securityHash: present(payload.securityHash),
  };
}

function signedBody(body: Record<string, unknown>): Record<string, unknown> {
  const cfg = tamiConfig();
  const securityHash = generateJwkSignature(cfg.kid, cfg.k, body);
  return { ...body, securityHash };
}

async function tamiPost(path: string, body: Record<string, unknown>): Promise<TamiJson> {
  const cfg = tamiConfig();
  if (!isTamiReady() || !hasUsableTamiPosId(cfg.posId, cfg.merchantId)) {
    paymentLog('tami_http_blocked', { path, reason: 'missing_pos_id' });
    return { success: false, errorCode: 'missing_pos_id', errorMessage: 'Tami POS / Terminal ID henüz yapılandırılmadı.' };
  }
  const payload = signedBody(body);
  const correlationId = `Correlation${randomBytes(16).toString('hex')}`;
  const response = await fetch(`${cfg.baseUrl}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'Accept-Language': 'tr',
      // Kept at v3 until Tami SecurityHash Hesaplama v2 document confirms a different pair.
      'PG-Api-Version': 'v3',
      'PG-Auth-Token': generatePgAuthToken(cfg.merchantId, cfg.posId, cfg.secretKey),
      correlationId,
    },
    body: JSON.stringify(payload),
    cache: 'no-store',
  });
  const text = await response.text();
  let parsed: unknown = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = { success: false, errorMessage: 'tami_invalid_json' };
  }
  const data = isRecord(parsed) ? parsed : { success: false, errorMessage: 'tami_invalid_response' };
  const responseCorrelationId = response.headers.get('correlationId') || asString(data.correlationId) || undefined;
  paymentLog('tami_http', {
    path,
    httpStatus: response.status,
    success: data.success,
    errorCode: data.errorCode,
    errorMessage: asString(data.errorMessage) || undefined,
    correlationId,
    responseCorrelationId: responseCorrelationId && responseCorrelationId !== correlationId ? responseCorrelationId : undefined,
    paymentStatus: data.paymentStatus,
    orderStatus: data.orderStatus,
    payloadShape: path === '/payment/auth' ? describeTamiPayloadShape(payload) : undefined,
  });
  return data;
}

function buildAuthBody(input: CreatePaymentInput, card: PaymentCard): Record<string, unknown> {
  const order = input.order;
  const customer = order.customer;
  const fullName = `${customer.firstName} ${customer.lastName}`.trim();
  const orderId = tamiOrderId(order.orderNumber);
  const amount = Number(fromMinorUnits(tamiChargeMinor(order)).toFixed(2));
  const phone = digits(customer.phone);
  const address = customer.address || 'Belirtilmedi';
  const city = customer.city || 'Istanbul';
  const email = customer.email;
  const zip = customer.zipCode || '';
  const company = customer.company || fullName;

  return {
    amount,
    orderId,
    currency: 'TRY',
    installmentCount: Math.max(1, input.installment ?? 1),
    paymentGroup: 'PRODUCT',
    card: {
      holderName: card.holderName,
      cvv: card.cvv,
      number: digits(card.number),
      expireMonth: expiryMonth(card.expireMonth),
      expireYear: expiryYear(card.expireYear),
    },
    buyer: {
      buyerId: orderId,
      ipAddress: input.ip || '127.0.0.1',
      name: customer.firstName,
      surName: customer.lastName,
      city,
      country: 'TR',
      zipCode: zip,
      emailAddress: email,
      phoneNumber: phone,
      registrationAddress: address,
    },
    shippingAddress: {
      emailAddress: email,
      address,
      city,
      companyName: company,
      country: 'TR',
      district: '',
      contactName: fullName,
      phoneNumber: phone,
      zipCode: zip,
    },
    billingAddress: {
      emailAddress: email,
      address,
      city,
      companyName: company,
      country: 'TR',
      district: '',
      contactName: fullName,
      phoneNumber: phone,
      zipCode: zip,
    },
    callbackUrl: input.callbackUrl,
  };
}

function decodeThreeDsHtml(value: unknown): string | null {
  if (typeof value !== 'string' || !value) return null;
  try {
    const html = Buffer.from(value, 'base64').toString('utf8');
    return html.includes('<') ? html : null;
  } catch {
    return null;
  }
}

function mapQueryStatus(data: TamiJson): VerifyPaymentResult {
  const paymentStatus = asString(data.paymentStatus).toUpperCase();
  const success = data.success === true;
  const bankRef = asString(data.bankReferenceNumber) || undefined;
  if (success && (paymentStatus === 'SUCCESS' || paymentStatus === '')) {
    return { ok: true, status: 'paid', providerPaymentId: bankRef, paymentTransactionId: bankRef };
  }
  if (paymentStatus === 'NOT_COMPLETE') return { ok: true, status: 'processing' };
  if (paymentStatus === 'TIME_OUT' || paymentStatus === 'FAIL') return { ok: true, status: 'failed' };
  if (success) return { ok: true, status: 'processing' };
  return { ok: true, status: 'failed' };
}

export class TamiPaymentProvider implements PaymentProvider {
  id = 'tami' as const;

  isConfigured(): boolean {
    return isTamiReady();
  }

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    const cfg = tamiConfig();
    if (!isTamiReady() || !hasUsableTamiPosId(cfg.posId, cfg.merchantId)) {
      return { ok: false, code: 'not_configured', message: 'Tami POS / Terminal ID henüz yapılandırılmadı.' };
    }
    if (!input.card) {
      return { ok: false, code: 'provider_error', message: 'Kart bilgileri olmadan 3D Secure başlatılamaz.' };
    }
    try {
      const data = await tamiPost('/payment/auth', buildAuthBody(input, input.card));
      const html = decodeThreeDsHtml(data.threeDSHtmlContent);
      if (data.success === true && html) {
        return { ok: true, redirectUrl: 'tami-launch', providerReference: tamiOrderId(input.order.orderNumber), threeDsHtml: html };
      }
      if (data.success === true && !html) {
        paymentLog('tami_auth_no_3ds', { orderNumber: input.order.orderNumber });
        return { ok: false, code: 'provider_error', message: '3D Secure sayfası alınamadı. Lütfen tekrar deneyin.' };
      }
      return {
        ok: false,
        code: 'provider_error',
        message: asString(data.errorMessage) || 'Tami ile ödeme başlatılamadı. Lütfen daha sonra tekrar deneyin.',
      };
    } catch {
      paymentLog('tami_auth_error', { orderNumber: input.order.orderNumber });
      return { ok: false, code: 'provider_error', message: 'Tami ile ödeme başlatılamadı. Lütfen daha sonra tekrar deneyin.' };
    }
  }

  async verifyPayment(input: VerifyPaymentInput): Promise<VerifyPaymentResult> {
    const cfg = tamiConfig();
    const payload = input.payload;
    const orderId = payload.orderId || tamiOrderId(input.order.orderNumber);
    if (orderId && tamiOrderId(input.order.orderNumber) !== tamiOrderId(orderId) && orderId !== input.order.orderNumber) {
      paymentLog('tami_order_mismatch', { orderNumber: input.order.orderNumber });
      return { ok: false, message: 'Sipariş numarası doğrulanamadı.' };
    }
    if (payload.hashedData && !verifyCallbackHash(payload, cfg.secretKey)) {
      paymentLog('tami_hash_invalid', { orderNumber: input.order.orderNumber });
      return { ok: false, message: '3D Secure imzası doğrulanamadı.' };
    }
    const amountRaw = payload.txnAmount || payload.originalAmount || payload.amount;
    const chargeMinor = input.order.chargedAmountMinor;
    if (amountRaw) {
      if (typeof chargeMinor !== 'number' || chargeMinor <= 0 || !providerAmountMatches(amountRaw, chargeMinor)) {
        paymentLog('tami_amount_mismatch', { orderNumber: input.order.orderNumber });
        return { ok: true, status: 'failed' };
      }
    }
    if (!isTami3dsSuccess(payload)) {
      paymentLog('tami_3ds_failed', { orderNumber: input.order.orderNumber, mdStatus: payload.mdStatus });
      return { ok: true, status: 'failed' };
    }

    try {
      const completed = await tamiPost('/payment/complete-3ds', { orderId: tamiOrderId(input.order.orderNumber) });
      if (completed.success === true) {
        const bankRef = asString(completed.bankReferenceNumber) || payload.bankReferenceNumber || undefined;
        const paymentStatus = asString(completed.paymentStatus).toUpperCase();
        if (paymentStatus && paymentStatus !== 'SUCCESS') {
          return { ok: true, status: paymentStatus === 'NOT_COMPLETE' ? 'processing' : 'failed', providerPaymentId: bankRef };
        }
        return {
          ok: true,
          status: 'paid',
          providerPaymentId: bankRef,
          paymentTransactionId: bankRef,
          conversationId: tamiOrderId(input.order.orderNumber),
        };
      }
      paymentLog('tami_complete_failed', { orderNumber: input.order.orderNumber, errorCode: completed.errorCode });
      return { ok: true, status: 'failed' };
    } catch {
      paymentLog('tami_complete_error', { orderNumber: input.order.orderNumber });
      return { ok: false, message: '3D Secure tamamlama doğrulanamadı.' };
    }
  }

  async getPaymentStatus(order: CreatePaymentInput['order']): Promise<VerifyPaymentResult> {
    try {
      const data = await tamiPost('/payment/query', {
        orderId: tamiOrderId(order.orderNumber),
        isTransactionDetail: 'true',
      });
      return mapQueryStatus(data);
    } catch {
      return { ok: false, message: 'Tami durum sorgusu başarısız.' };
    }
  }

  async refundPayment(order: CreatePaymentInput['order']): Promise<{ ok: boolean; message: string }> {
    try {
      const data = await tamiPost('/payment/reverse', {
        orderId: tamiOrderId(order.orderNumber),
        amount: Number(fromMinorUnits(tamiChargeMinor(order)).toFixed(2)),
        reason: 'merchant refund',
      });
      if (data.success === true) return { ok: true, message: 'İade alındı.' };
      return { ok: false, message: asString(data.errorMessage) || 'İade başarısız.' };
    } catch {
      return { ok: false, message: 'Tami iade isteği gönderilemedi.' };
    }
  }

  async voidPayment(order: CreatePaymentInput['order']): Promise<{ ok: boolean; message: string }> {
    return this.refundPayment(order);
  }
}

export const TamiPaymentProviderInstance = TamiPaymentProvider;

export async function tamiHealth(): Promise<{ status: string; env: string; configured: boolean }> {
  const cfg = tamiConfig();
  if (!cfg.enabled) return { status: 'DISABLED', env: cfg.env, configured: false };
  if (!hasUsableTamiPosId(cfg.posId, cfg.merchantId)) {
    return { status: 'MISSING_POS_ID', env: cfg.env, configured: false };
  }
  if (!isTamiReady()) return { status: 'MISSING_CREDENTIALS', env: cfg.env, configured: false };
  return { status: 'READY', env: cfg.env, configured: true };
}
