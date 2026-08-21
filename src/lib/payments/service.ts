import { quoteProduct, type PaymentPeriod } from '@/lib/commerce-server';
import { grantDownloadEntitlement, revokeDownloadEntitlementsForOrder } from '@/lib/downloads/store';
import { LEGAL_VERSIONS } from '@/lib/legal/versions';
import { formatMinor } from '@/lib/money';
import { publicBaseUrl, qnbpayConfig } from '@/lib/payments/config';
import {
  appendAudit,
  createAttemptId,
  createOrderId,
  getLatestAttempt,
  getOrderById,
  getOrderByIdempotency,
  getOrderByProviderToken,
  saveAttempt,
  saveOrder,
  updateAttempt,
  updateOrder,
} from '@/lib/payments/orders';
import { getPaymentProvider } from '@/lib/payments/providers';
import { launchToken } from '@/lib/payments/qnb-payfor';
import { paymentLog, randomToken } from '@/lib/payments/security';
import type { OrderRecord, PaymentCustomer, PaymentProviderId, PublicOrderView } from '@/lib/payments/types';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^\+[1-9]\d{9,14}$/;

export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('90') && digits.length === 12) return `+${digits}`;
  if (digits.startsWith('0') && digits.length === 11) return `+90${digits.slice(1)}`;
  if (digits.length === 10) return `+90${digits}`;
  if (phone.startsWith('+')) return `+${digits}`;
  return phone.trim();
}

export function normalizeCustomer(customer: PaymentCustomer): PaymentCustomer {
  return {
    ...customer,
    firstName: customer.firstName.trim(),
    lastName: customer.lastName.trim(),
    email: customer.email.trim().toLowerCase(),
    phone: normalizePhone(customer.phone),
    identityNumber: customer.identityNumber.replace(/\s/g, ''),
    company: customer.company?.trim() || undefined,
    taxOffice: customer.taxOffice?.trim() || undefined,
    address: customer.address.trim(),
    city: customer.city.trim(),
    country: 'Turkey',
    zipCode: customer.zipCode?.trim() || undefined,
  };
}

export function validateCustomer(customer: PaymentCustomer): string | null {
  if (!customer.firstName || !customer.lastName) return 'Ad ve soyad zorunludur.';
  if (!EMAIL.test(customer.email)) return 'Geçerli bir e-posta girin.';
  if (!PHONE.test(customer.phone)) return 'Geçerli bir telefon girin.';
  if (!customer.address || !customer.city) return 'Fatura adresi zorunludur.';
  const identity = customer.identityNumber;
  if (customer.billingType === 'company') {
    if (!/^\d{10}$/.test(identity)) return 'Vergi numarası 10 haneli olmalıdır.';
    if (!customer.company) return 'Firma ünvanı zorunludur.';
    if (!customer.taxOffice) return 'Vergi dairesi zorunludur.';
  } else if (!isValidTckn(identity)) {
    return 'T.C. kimlik numarası geçersiz.';
  }
  return null;
}

function isValidTckn(value: string): boolean {
  if (!/^[1-9]\d{10}$/.test(value)) return false;
  const d = value.split('').map(Number);
  const odd = d[0] + d[2] + d[4] + d[6] + d[8];
  const even = d[1] + d[3] + d[5] + d[7];
  if ((odd * 7 - even) % 10 !== d[9]) return false;
  return d.slice(0, 10).reduce((sum, n) => sum + n, 0) % 10 === d[10];
}

function mapStatus(status: 'paid' | 'failed' | 'cancelled' | 'processing') {
  if (status === 'paid') return 'paid' as const;
  if (status === 'cancelled') return 'cancelled' as const;
  if (status === 'processing') return 'processing' as const;
  return 'failed' as const;
}

type CheckoutResult = { order: OrderRecord; redirectUrl?: string; message?: string; configured: boolean };

const checkoutLocks = new Map<string, Promise<CheckoutResult>>();

export async function startCheckout(input: {
  productId?: string;
  orderId?: string;
  period: PaymentPeriod;
  quantity: number;
  provider: PaymentProviderId;
  customer: PaymentCustomer;
  ip: string;
  idempotencyKey: string;
  legalAccepted: boolean;
  marketingOptIn?: boolean;
  distanceSalesVersion?: string;
  preInformationVersion?: string;
  installment?: number;
  cardProgram?: string;
  request?: Request;
}): Promise<CheckoutResult> {
  if (input.provider !== 'qnbpay') {
    throw new Error('Bu ödeme yöntemi artık kullanılmıyor. QNBpay ile devam edin.');
  }
  const lockKey = `${input.idempotencyKey}:${input.orderId || input.productId || ''}`;
  const pending = checkoutLocks.get(lockKey);
  if (pending) return pending;
  const run = startCheckoutUnlocked(input).finally(() => {
    if (checkoutLocks.get(lockKey) === run) checkoutLocks.delete(lockKey);
  });
  checkoutLocks.set(lockKey, run);
  return run;
}

async function startCheckoutUnlocked(input: {
  productId?: string;
  orderId?: string;
  period: PaymentPeriod;
  quantity: number;
  provider: PaymentProviderId;
  customer: PaymentCustomer;
  ip: string;
  idempotencyKey: string;
  legalAccepted: boolean;
  marketingOptIn?: boolean;
  distanceSalesVersion?: string;
  preInformationVersion?: string;
  installment?: number;
  cardProgram?: string;
  request?: Request;
}): Promise<CheckoutResult> {
  if (!input.legalAccepted) {
    throw new Error('Mesafeli satış sözleşmesi ve ön bilgilendirme formu kabul edilmeden ödeme başlatılamaz.');
  }
  if (
    input.distanceSalesVersion !== LEGAL_VERSIONS.distanceSales.version ||
    input.preInformationVersion !== LEGAL_VERSIONS.preInformation.version
  ) {
    throw new Error('Sözleşme metni güncellendi. Lütfen güncel metinleri inceleyerek yeniden kabul edin.');
  }
  if (!input.idempotencyKey || input.idempotencyKey.length < 16) {
    throw new Error('Ödeme isteği doğrulanamadı.');
  }
  const customer = normalizeCustomer(input.customer);
  const customerError = validateCustomer(customer);
  if (customerError) throw new Error(customerError);

  const existing = input.orderId ? await getOrderById(input.orderId) : await getOrderByIdempotency(input.idempotencyKey);
  if (existing?.status === 'paid') {
    throw new Error('Bu sipariş zaten ödendi.');
  }
  if (existing?.status === 'processing') {
    throw new Error('Ödeme doğrulanıyor. Lütfen bekleyin.');
  }

  const productId = existing?.productId ?? input.productId ?? '';
  const quote = quoteProduct({
    productId,
    period: existing?.period ?? input.period,
    quantity: existing?.quantity ?? input.quantity,
  });
  if ('error' in quote) throw new Error(quote.error);
  if (existing && existing.productId !== quote.productId) {
    throw new Error('Bu ödeme isteği başka bir ürün için kullanılmış.');
  }
  if (existing && existing.amountMinor !== quote.totalMinor) {
    throw new Error('Ürün fiyatı değişti. Lütfen ödeme sayfasını yenileyin.');
  }

  const now = new Date().toISOString();
  const legal = {
    distanceSalesVersion: LEGAL_VERSIONS.distanceSales.version,
    preInformationVersion: LEGAL_VERSIONS.preInformation.version,
    acceptedAt: now,
    marketingOptIn: input.marketingOptIn === true,
  };

  const baseFields = {
    productId: quote.productId,
    productName: quote.productName,
    description: quote.description,
    quantity: quote.quantity,
    period: quote.period,
    currency: quote.currency,
    unitAmountMinor: Math.round(quote.subtotalMinor / Math.max(1, quote.quantity)),
    subtotalMinor: quote.subtotalMinor,
    vatMinor: quote.vatMinor,
    vatRatePercent: quote.vatRatePercent,
    amountMinor: quote.totalMinor,
    paymentProvider: input.provider,
    customerName: `${customer.firstName} ${customer.lastName}`.trim(),
    customerEmail: customer.email,
    customerPhone: customer.phone,
    customer,
    distanceSalesVersion: legal.distanceSalesVersion,
    preInformationVersion: legal.preInformationVersion,
    legalAcceptedAt: legal.acceptedAt,
    legalAcceptance: legal,
  } as const;

  const order: OrderRecord = existing
    ? ((await updateOrder(existing.id, {
        ...baseFields,
        status: existing.status === 'failed' || existing.status === 'cancelled' ? 'pending' : existing.status,
      })) ?? existing)
    : await saveOrder({
        id: createOrderId(),
        orderNumber: createOrderId().replace('TG-', 'SIP-'),
        ...baseFields,
        status: 'pending',
        providerPaymentId: null,
        providerConversationId: null,
        providerToken: null,
        paymentTransactionId: null,
        processedTransactionIds: [],
        billingAddress: customer.address,
        idempotencyKey: input.idempotencyKey,
        statusToken: randomToken(),
        paidAt: null,
        createdAt: now,
        updatedAt: now,
      });

  if (order.status === 'paid') throw new Error('Bu sipariş zaten ödendi.');

  if (order.status === 'awaiting_payment') {
    const latest = await getLatestAttempt(order.id);
    if (latest && (latest.status === 'redirected' || latest.status === 'created') && qnbpayConfig().mode === 'payfor') {
      const provider = getPaymentProvider('qnbpay');
      if (!provider.isConfigured()) {
        return { order, configured: false, message: 'QNBpay yapılandırması tamamlanmamış.' };
      }
      const base = publicBaseUrl(input.request);
      return {
        order,
        configured: true,
        redirectUrl: `${base}/api/payments/qnbpay/launch?order=${encodeURIComponent(order.id)}&attempt=${encodeURIComponent(latest.id)}&sig=${encodeURIComponent(launchToken(latest.id, order.id))}`,
      };
    }
  }

  const attempt = await saveAttempt({
    id: createAttemptId(),
    orderId: order.id,
    provider: input.provider,
    status: 'created',
    amountMinor: quote.totalMinor,
    currency: quote.currency,
    installment: Math.max(1, Number(input.installment ?? 1) || 1),
    cardProgram: input.cardProgram?.trim() || null,
    providerReference: null,
    providerTransactionId: null,
    responseCode: null,
    createdAt: now,
    updatedAt: now,
  });
  await appendAudit({ orderId: order.id, attemptId: attempt.id, provider: input.provider, event: 'attempt_created', status: 'created' });

  const provider = getPaymentProvider(input.provider);
  if (!provider.isConfigured()) {
    paymentLog('payment_not_configured', { provider: input.provider, orderNumber: order.orderNumber });
    await appendAudit({ orderId: order.id, attemptId: attempt.id, provider: input.provider, event: 'not_configured' });
    return { order, configured: false, message: 'QNBpay yapılandırması tamamlanmamış.' };
  }

  const started = await updateOrder(order.id, {
    status: 'awaiting_payment',
    paymentProvider: input.provider,
    providerConversationId: order.id,
    customer,
  });
  const current = started ?? { ...order, customer, status: 'awaiting_payment' as const };
  const base = publicBaseUrl(input.request);
  const result = await provider.createPayment({
    order: current,
    callbackUrl: `${base}/api/payments/${input.provider}/callback`,
    cancelUrl: `${base}/payment/cancelled?order=${encodeURIComponent(current.id)}`,
    ip: input.ip,
    installment: attempt.installment,
    cardProgram: attempt.cardProgram ?? undefined,
  });

  if (!result.ok) {
    await updateAttempt(attempt.id, { status: 'failed' });
    await updateOrder(current.id, { status: 'failed' });
    await appendAudit({
      orderId: current.id,
      attemptId: attempt.id,
      provider: input.provider,
      event: 'create_failed',
      status: 'failed',
      responseCode: result.code,
    });
    return { order: current, configured: true, message: result.message };
  }

  await updateAttempt(attempt.id, { status: 'redirected', providerReference: result.providerReference });
  await updateOrder(current.id, {
    providerToken: result.providerReference,
    providerPaymentId: result.providerReference,
    status: 'awaiting_payment',
    billingAddress: customer.address,
  });
  const redirectUrl =
    result.redirectUrl === 'payfor-launch'
      ? `${base}/api/payments/qnbpay/launch?order=${encodeURIComponent(current.id)}&attempt=${encodeURIComponent(attempt.id)}&sig=${encodeURIComponent(launchToken(attempt.id, current.id))}`
      : result.redirectUrl;
  paymentLog('payment_started', { provider: input.provider, orderNumber: current.orderNumber, attemptId: attempt.id });
  await appendAudit({
    orderId: current.id,
    attemptId: attempt.id,
    provider: input.provider,
    event: 'redirected',
    status: 'awaiting_payment',
    providerReference: result.providerReference,
  });
  return { order: current, redirectUrl, configured: true };
}

export async function finalizeFromCallback(
  providerId: PaymentProviderId,
  payload: Record<string, string>
): Promise<OrderRecord | null> {
  const order =
    (await getOrderByProviderToken(payload.token || payload.paymentId || '')) ||
    (await getOrderById(payload.conversationId || payload.invoice_id || payload.OrderId || payload.order_id || payload.merchantOid || ''));
  if (!order) return null;
  const txn = payload.TransId || payload.transaction_id || payload.paymentId || payload.token || payload.HostRefNum || '';
  if (order.status === 'paid') return order;
  if (txn && order.processedTransactionIds?.includes(txn)) return order;

  await updateOrder(order.id, { status: 'processing' });
  const provider = getPaymentProvider(providerId);
  const verified = await provider.verifyPayment({ order, payload });
  const attempt = await getLatestAttempt(order.id);
  if (!verified.ok) {
    if (attempt) {
      await updateAttempt(attempt.id, { status: 'failed', responseCode: payload.ProcReturnCode || payload.status_code || null });
    }
    await updateOrder(order.id, { status: 'failed' });
    await appendAudit({ orderId: order.id, provider: providerId, event: 'verify_error', status: 'failed' });
    return { ...order, status: 'failed' };
  }
  const status = mapStatus(verified.status);
  const paidAt = status === 'paid' ? new Date().toISOString() : order.paidAt;
  const next = await updateOrder(order.id, {
    status,
    paidAt,
    paymentProvider: providerId,
    providerPaymentId: verified.providerPaymentId ?? order.providerPaymentId,
    paymentTransactionId: verified.paymentTransactionId ?? order.paymentTransactionId,
    providerConversationId: verified.conversationId ?? order.providerConversationId,
    processedTransactionIds:
      status === 'paid' && txn
        ? Array.from(new Set([...(order.processedTransactionIds ?? []), txn]))
        : order.processedTransactionIds,
  });
  if (attempt) {
    await updateAttempt(attempt.id, {
      status: status === 'paid' ? 'paid' : status === 'cancelled' ? 'cancelled' : status === 'processing' ? 'redirected' : 'failed',
      providerTransactionId: verified.paymentTransactionId ?? verified.providerPaymentId ?? attempt.providerTransactionId,
      providerReference: verified.providerPaymentId ?? attempt.providerReference,
      responseCode: payload.ProcReturnCode || payload.transaction_status || payload.status_code || null,
    });
  }
  await appendAudit({
    orderId: order.id,
    provider: providerId,
    event: 'verified',
    status,
    providerReference: verified.providerPaymentId,
  });

  if (status === 'paid' && next) {
    await grantDownloadEntitlement({
      orderId: next.id,
      productId: next.productId,
      paymentId: next.paymentTransactionId ?? next.providerPaymentId,
      statusToken: next.statusToken,
      customerEmail: next.customerEmail,
    });
  }

  return next;
}

export async function cancelUnpaidOrder(id: string): Promise<OrderRecord | null> {
  const order = await getOrderById(id);
  if (!order) return null;
  if (order.status === 'paid') return order;
  return updateOrder(order.id, { status: 'cancelled' });
}

export async function refundPaidOrder(orderId: string): Promise<{ ok: boolean; message: string }> {
  const order = await getOrderById(orderId);
  if (!order) return { ok: false, message: 'Sipariş bulunamadı.' };
  if (order.status !== 'paid') return { ok: false, message: 'Yalnızca ödenmiş sipariş iade edilebilir.' };
  if (!order.paymentProvider) return { ok: false, message: 'Ödeme sağlayıcısı yok.' };
  const result = await getPaymentProvider(order.paymentProvider).refundPayment(order);
  if (result.ok) {
    await updateOrder(order.id, { status: 'refunded' });
    await revokeDownloadEntitlementsForOrder(order.id);
    await appendAudit({ orderId: order.id, provider: order.paymentProvider, event: 'refunded', status: 'refunded' });
  }
  return result;
}

export function toPublicOrder(order: OrderRecord): PublicOrderView {
  return {
    orderNumber: order.orderNumber,
    productName: order.productName,
    status: order.status === 'payment_started' ? 'awaiting_payment' : order.status,
    paymentProvider: order.paymentProvider,
    amountLabel: formatMinor(order.amountMinor, order.currency),
    currency: order.currency,
  };
}
