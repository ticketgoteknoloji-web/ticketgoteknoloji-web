import { randomBytes } from 'crypto';
import { fromMinorUnits } from '@/lib/money';
import { providerAmountMatches } from '@/lib/payments/amount';
import { tamiChargeMinor } from '@/lib/payments/charge';
import { hasUsableTamiPosId, isTamiReady, tamiConfig } from '@/lib/payments/config';
import { paymentLog } from '@/lib/payments/security';
import {
  createTamiSignedRequest,
  generatePgAuthToken,
  isTami3dsSuccess,
  readTamiSignedResponse,
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

const TAMI_AUTH_PATH = '/api/v0/payment/auth';
const TAMI_COMPLETE_PATH = '/api/v0/payment/complete-3ds';
const TAMI_QUERY_PATH = '/api/v0/payment/orderQuery';
const TAMI_REFUND_PATH = '/api/v0/payment/refund';
const TAMI_VOID_PATH = '/api/v0/payment/void';
const COMPLETE_3DS_TIMEOUT_MS = 20_000;

function tamiUrl(base: string, path: string): string {
  const root = base.replace(/\/$/, '');
  if (path.startsWith('/api/v0/') && root.endsWith('/api/v0')) return `${root}${path.slice('/api/v0'.length)}`;
  return `${root}${path}`;
}

function isTimeoutError(error: unknown): boolean {
  if (!error || typeof error !== 'object' || !('name' in error)) return false;
  const name = String(error.name);
  return name === 'TimeoutError' || name === 'AbortError';
}

function readBankBody(data: TamiJson, cfg: ReturnType<typeof tamiConfig>): TamiJson {
  if (typeof data.signedResponse === 'string') {
    const body = readTamiSignedResponse(data.signedResponse, cfg.k, cfg.merchantId, cfg.posId);
    return body ?? { success: false, errorCode: 'response_unverified' };
  }
  if (data.success === false || asString(data.success).toLowerCase() === 'false') return data;
  return { success: false, errorCode: 'response_unverified' };
}

async function tamiPost(path: string, body: Record<string, unknown>, timeoutMs?: number): Promise<TamiJson> {
  const cfg = tamiConfig();
  if (!isTamiReady() || !hasUsableTamiPosId(cfg.posId, cfg.merchantId)) {
    paymentLog('tami_http_blocked', { path, reason: 'missing_pos_id' });
    return { success: false, errorCode: 'missing_pos_id', errorMessage: 'Tami POS / Terminal ID henüz yapılandırılmadı.' };
  }
  const signedRequest = createTamiSignedRequest({
    kid: cfg.kid,
    k: cfg.k,
    merchantNumber: cfg.merchantId,
    terminalNumber: cfg.posId,
    body,
  });
  const correlationId = `Correlation${randomBytes(16).toString('hex')}`;
  let response: Response;
  try {
    response = await fetch(tamiUrl(cfg.baseUrl, path), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'Accept-Language': 'tr',
        'PG-Api-Version': 'v4',
        'PG-Auth-Token': generatePgAuthToken(cfg.merchantId, cfg.posId, cfg.secretKey),
        correlationId,
      },
      body: JSON.stringify({ signedRequest }),
      cache: 'no-store',
      signal: timeoutMs ? AbortSignal.timeout(timeoutMs) : undefined,
    });
  } catch (error) {
    if (isTimeoutError(error)) {
      paymentLog('tami_http_timeout', { path });
      return { success: false, errorCode: 'timeout' };
    }
    throw error;
  }
  const text = await response.text();
  let parsed: unknown = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = { success: false, errorMessage: 'tami_invalid_json' };
  }
  const wire = isRecord(parsed) ? parsed : { success: false, errorMessage: 'tami_invalid_response' };
  const data = readBankBody(wire, cfg);
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
    payloadShape: path === TAMI_AUTH_PATH ? describeTamiPayloadShape(body) : undefined,
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

const CALLBACK_BOUND_FIELDS = ['orderId', 'txnAmount', 'currencyCode'] as const;

function callbackCoversPayment(payload: Record<string, string>): boolean {
  const fields = new Set(
    (payload.hashParams || '')
      .split('+')
      .map((field) => field.trim())
      .filter(Boolean)
  );
  return CALLBACK_BOUND_FIELDS.every((field) => fields.has(field));
}

function tryChargeMinor(order: CreatePaymentInput['order']): number | null {
  if (order.chargedCurrency === 'TRY' && typeof order.chargedAmountMinor === 'number' && order.chargedAmountMinor > 0) {
    return order.chargedAmountMinor;
  }
  return null;
}

function callbackOrderMatches(order: CreatePaymentInput['order'], rawOrderId: string): boolean {
  const received = rawOrderId.trim();
  if (!received) return false;
  return tamiOrderId(received) === tamiOrderId(order.orderNumber);
}

function completionAmount(value: unknown): string | number | undefined {
  return typeof value === 'number' || typeof value === 'string' ? value : undefined;
}

function bankSuccess(value: unknown): boolean {
  return value === true || (typeof value === 'string' && value.trim().toLowerCase() === 'true');
}

function bankFailure(value: unknown): boolean {
  return value === false || (typeof value === 'string' && value.trim().toLowerCase() === 'false');
}

function completionMatches(data: TamiJson, order: CreatePaymentInput['order']): boolean {
  const responseOrder = asString(data.orderId).trim();
  const currency = asString(data.currency || data.currencyCode).trim().toUpperCase();
  const chargeMinor = tryChargeMinor(order);
  return (
    Boolean(responseOrder) &&
    tamiOrderId(responseOrder) === tamiOrderId(order.orderNumber) &&
    chargeMinor != null &&
    currency === 'TRY' &&
    providerAmountMatches(completionAmount(data.amount), chargeMinor)
  );
}

function paidResult(order: CreatePaymentInput['order'], bankRef: string | undefined): VerifyPaymentResult {
  return {
    ok: true,
    status: 'paid',
    providerPaymentId: bankRef,
    paymentTransactionId: bankRef,
    conversationId: tamiOrderId(order.orderNumber),
  };
}

function assessOrderQuery(data: TamiJson, order: CreatePaymentInput['order']): VerifyPaymentResult {
  if (asString(data.errorCode) === 'timeout' || asString(data.errorCode) === 'response_unverified') {
    return { ok: true, status: 'processing' };
  }
  if (!bankSuccess(data.success) || !Array.isArray(data.content)) {
    paymentLog('tami_query_unsettled', { orderNumber: order.orderNumber, errorCode: data.errorCode });
    return { ok: true, status: 'processing' };
  }
  const row = data.content.find(
    (item) => isRecord(item) && callbackOrderMatches(order, asString(item.orderId))
  );
  if (!isRecord(row)) return { ok: true, status: 'processing' };
  const paymentStatus = asString(row.paymentStatus).toUpperCase();
  const orderStatus = asString(row.orderStatus).toUpperCase();
  const bankRef = asString(row.bankReferenceNumber) || undefined;
  if (paymentStatus === 'SUCCESS' && orderStatus === 'AUTH' && completionMatches(row, order)) {
    return paidResult(order, bankRef);
  }
  if (paymentStatus === 'FAIL' || paymentStatus === 'TIME_OUT') {
    paymentLog('tami_query_not_paid', { orderNumber: order.orderNumber });
    return { ok: true, status: 'failed' };
  }
  return { ok: true, status: 'processing' };
}

function assessComplete3ds(data: TamiJson, order: CreatePaymentInput['order']): VerifyPaymentResult {
  if (asString(data.errorCode) === 'timeout' || asString(data.errorCode) === 'response_unverified') {
    return { ok: true, status: 'processing' };
  }
  if (bankFailure(data.success)) {
    paymentLog('tami_complete_failed', { orderNumber: order.orderNumber, errorCode: data.errorCode });
    return { ok: true, status: 'failed' };
  }
  if (bankSuccess(data.success) && completionMatches(data, order)) {
    return paidResult(order, asString(data.bankReferenceNumber) || undefined);
  }
  paymentLog('tami_complete_unsettled', { orderNumber: order.orderNumber, errorCode: data.errorCode });
  return { ok: true, status: 'processing' };
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
      const data = await tamiPost(TAMI_AUTH_PATH, buildAuthBody(input, input.card));
      const html = decodeThreeDsHtml(data.threeDSHtmlContent);
      if (bankSuccess(data.success) && html) {
        return { ok: true, redirectUrl: 'tami-launch', providerReference: tamiOrderId(input.order.orderNumber), threeDsHtml: html };
      }
      if (bankSuccess(data.success) && !html) {
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
    const order = input.order;
    if (!callbackOrderMatches(order, payload.orderId || '')) {
      paymentLog('tami_order_mismatch', { orderNumber: order.orderNumber });
      return { ok: false, message: 'Sipariş numarası doğrulanamadı.' };
    }
    if (
      !payload.hashParams?.trim() ||
      !payload.hashedData?.trim() ||
      !callbackCoversPayment(payload) ||
      !verifyCallbackHash(payload, cfg.secretKey)
    ) {
      paymentLog('tami_hash_invalid', { orderNumber: order.orderNumber });
      return { ok: false, message: '3D Secure imzası doğrulanamadı.' };
    }
    const chargeMinor =
      order.chargedCurrency === 'TRY' && typeof order.chargedAmountMinor === 'number' && order.chargedAmountMinor > 0
        ? order.chargedAmountMinor
        : null;
    const currency = (payload.currencyCode || '').trim().toUpperCase();
    if (chargeMinor == null || currency !== 'TRY' || !providerAmountMatches(payload.txnAmount, chargeMinor)) {
      paymentLog('tami_amount_mismatch', { orderNumber: order.orderNumber });
      return { ok: true, status: 'failed' };
    }
    if (!isTami3dsSuccess(payload)) {
      paymentLog('tami_3ds_failed', { orderNumber: order.orderNumber, mdStatus: payload.mdStatus });
      return { ok: true, status: 'failed' };
    }

    try {
      const completed = await tamiPost(
        TAMI_COMPLETE_PATH,
        { orderId: tamiOrderId(order.orderNumber) },
        COMPLETE_3DS_TIMEOUT_MS
      );
      if (asString(completed.errorCode) === 'timeout') {
        paymentLog('tami_complete_timeout', { orderNumber: order.orderNumber });
        const queried = await tamiPost(
          TAMI_QUERY_PATH,
          { orderId: tamiOrderId(order.orderNumber), isTransactionDetail: false },
          COMPLETE_3DS_TIMEOUT_MS
        );
        if (asString(queried.errorCode) === 'timeout') {
          paymentLog('tami_query_timeout', { orderNumber: order.orderNumber });
          return { ok: true, status: 'processing' };
        }
        return assessOrderQuery(queried, order);
      }
      return assessComplete3ds(completed, order);
    } catch {
      paymentLog('tami_complete_error', { orderNumber: order.orderNumber });
      return { ok: true, status: 'processing' };
    }
  }

  async getPaymentStatus(order: CreatePaymentInput['order']): Promise<VerifyPaymentResult> {
    try {
      const data = await tamiPost(TAMI_QUERY_PATH, {
        orderId: tamiOrderId(order.orderNumber),
        isTransactionDetail: false,
      });
      return assessOrderQuery(data, order);
    } catch {
      return { ok: false, message: 'Tami durum sorgusu başarısız.' };
    }
  }

  async refundPayment(order: CreatePaymentInput['order']): Promise<{ ok: boolean; message: string }> {
    try {
      const data = await tamiPost(TAMI_REFUND_PATH, {
        orderId: tamiOrderId(order.orderNumber),
        amount: Number(fromMinorUnits(tamiChargeMinor(order)).toFixed(2)),
        reason: 'merchant refund',
      });
      if (bankSuccess(data.success)) return { ok: true, message: 'İade alındı.' };
      return { ok: false, message: asString(data.errorMessage) || 'İade başarısız.' };
    } catch {
      return { ok: false, message: 'Tami iade isteği gönderilemedi.' };
    }
  }

  async voidPayment(order: CreatePaymentInput['order']): Promise<{ ok: boolean; message: string }> {
    try {
      const data = await tamiPost(TAMI_VOID_PATH, {
        orderId: tamiOrderId(order.orderNumber),
        reason: 'merchant void',
      });
      if (bankSuccess(data.success)) return { ok: true, message: 'İptal alındı.' };
      return { ok: false, message: asString(data.errorMessage) || 'İptal başarısız.' };
    } catch {
      return { ok: false, message: 'Tami iptal isteği gönderilemedi.' };
    }
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
