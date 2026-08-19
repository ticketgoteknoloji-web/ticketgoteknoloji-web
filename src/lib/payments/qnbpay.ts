import { merchantInstallmentCounts } from '@/config/qnbpay-card-programs';
import { formatProviderMoney, providerAmountMatches } from '@/lib/payments/amount';
import { qnbpayConfig } from '@/lib/payments/config';
import { payforAdminTxn, verifyPayforCallback } from '@/lib/payments/qnb-payfor';
import { paymentLog, stripCardFields } from '@/lib/payments/security';
import { sipayDecryptHash, sipayHashKey } from '@/lib/payments/sipay-hash';
import type {
  CreatePaymentInput,
  CreatePaymentResult,
  OrderRecord,
  PaymentProvider,
  VerifyPaymentInput,
  VerifyPaymentResult,
} from '@/lib/payments/types';

export class QnbPayService implements PaymentProvider {
  id = 'qnbpay' as const;

  isConfigured(): boolean {
    return qnbpayConfig().configured;
  }

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    return this.create3DPayment(input);
  }

  async create3DPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    const config = qnbpayConfig();
    if (!config.configured) {
      return { ok: false, code: 'not_configured', message: 'QNBpay yapılandırması tamamlanmamış.' };
    }
    const installment = normalizeInstallment(input.installment);
    if (config.mode === 'payfor') {
      paymentLog('qnbpay_3dhost_ready', { orderNumber: input.order.orderNumber, installment });
      return {
        ok: true,
        redirectUrl: 'payfor-launch',
        providerReference: input.order.orderNumber,
      };
    }
    return this.createSipayHostedLink(input, installment);
  }

  async verifyPayment(input: VerifyPaymentInput): Promise<VerifyPaymentResult> {
    const config = qnbpayConfig();
    if (config.mode === 'payfor' || input.payload.ProcReturnCode || input.payload.ResponseHash) {
      return verifyPayforCallback(input.order, input.payload);
    }
    return this.verifySipay(input);
  }

  async getPaymentStatus(order: OrderRecord): Promise<VerifyPaymentResult> {
    if (qnbpayConfig().mode === 'payfor') {
      return { ok: false, message: 'PayFor durum sorgusu callback hash doğrulaması ile yapılır.' };
    }
    return this.checkSipay(order);
  }

  async refundPayment(order: OrderRecord): Promise<{ ok: boolean; message: string }> {
    if (qnbpayConfig().mode === 'payfor') return payforAdminTxn(order, 'Refund');
    return { ok: false, message: 'Sipay iadesi üye işyeri refund API alanları doğrulandıktan sonra kullanılabilir.' };
  }

  async voidPayment(order: OrderRecord): Promise<{ ok: boolean; message: string }> {
    if (qnbpayConfig().mode === 'payfor') return payforAdminTxn(order, 'Void');
    return { ok: false, message: 'Sipay void/iptal üye işyeri API alanları doğrulandıktan sonra kullanılabilir.' };
  }

  getInstallments() {
    return merchantInstallmentCounts();
  }

  private async createSipayHostedLink(input: CreatePaymentInput, installment: number): Promise<CreatePaymentResult> {
    const { merchantKey, sipayBaseUrl } = qnbpayConfig();
    const token = await sipayAccessToken();
    if (!token) {
      return { ok: false, code: 'provider_error', message: 'QNBpay ile ödeme başlatılamadı. Lütfen daha sonra tekrar deneyin.' };
    }
    const total = formatProviderMoney(input.order.amountMinor);
    const invoice = {
      invoice_id: input.order.orderNumber,
      invoice_description: input.order.productName,
      total,
      discount: 0,
      coupon: null,
      return_url: input.callbackUrl,
      cancel_url: input.cancelUrl,
      items: [{ name: input.order.productName, price: total, quantity: 1, description: input.order.description }],
      bill_email: input.order.customer.email,
      bill_phone: input.order.customer.phone,
      response_method: 'POST',
      max_installment: installment > 1 ? installment : 1,
    };
    try {
      const result = await sipayPost<{ status_code?: number; link?: string; order_id?: string }>(
        '/ccpayment/purchase/link',
        {
          merchant_key: merchantKey,
          currency_code: input.order.currency,
          name: input.order.customer.firstName,
          surname: input.order.customer.lastName,
          bill_email: input.order.customer.email,
          bill_phone: input.order.customer.phone,
          bill_address1: input.order.customer.address,
          bill_city: input.order.customer.city,
          bill_country: input.order.customer.country,
          order_type: 0,
          app_lang: 'tr',
          invoice: JSON.stringify(invoice),
        },
        token,
        sipayBaseUrl
      );
      if (!result.link) {
        paymentLog('qnbpay_link_failed', { orderNumber: input.order.orderNumber, status_code: result.status_code });
        return { ok: false, code: 'provider_error', message: 'QNBpay ile ödeme başlatılamadı. Lütfen daha sonra tekrar deneyin.' };
      }
      return { ok: true, redirectUrl: result.link, providerReference: String(result.order_id ?? input.order.orderNumber) };
    } catch {
      paymentLog('qnbpay_link_error', { orderNumber: input.order.orderNumber });
      return { ok: false, code: 'provider_error', message: 'QNBpay ile ödeme başlatılamadı. Lütfen daha sonra tekrar deneyin.' };
    }
  }

  private async verifySipay(input: VerifyPaymentInput): Promise<VerifyPaymentResult> {
    const { appSecret } = qnbpayConfig();
    const hash = input.payload.hash_key;
    if (hash) {
      const decrypted = sipayDecryptHash(hash, appSecret);
      if (!decrypted) {
        paymentLog('qnbpay_hash_invalid', { orderNumber: input.order.orderNumber });
        return { ok: true, status: 'failed' };
      }
      if (!decrypted.includes(input.order.orderNumber) && !decrypted.includes(input.order.id)) {
        paymentLog('qnbpay_hash_order_mismatch', { orderNumber: input.order.orderNumber });
        return { ok: true, status: 'failed' };
      }
    }
    if ((input.payload.status === '1' || input.payload.success === '1') && !hash) {
      paymentLog('qnbpay_browser_success_ignored', { orderNumber: input.order.orderNumber });
    }
    return this.checkSipay(input.order);
  }

  private async checkSipay(order: OrderRecord): Promise<VerifyPaymentResult> {
    const { merchantKey, appSecret, sipayBaseUrl } = qnbpayConfig();
    const token = await sipayAccessToken();
    if (!token) return { ok: false, message: 'QNBpay oturumu açılamadı.' };
    try {
      const result = await sipayPost<{
        status_code?: number;
        transaction_status?: string;
        transaction_id?: string;
        invoice_id?: string;
        invoice_amount?: string | number;
        amount?: string | number;
        currency_code?: string;
        order_id?: string | number;
      }>(
        '/ccpayment/api/checkstatus',
        {
          merchant_key: merchantKey,
          invoice_id: order.orderNumber,
          include_pending_status: true,
          hash_key: sipayHashKey([order.orderNumber, merchantKey], appSecret),
          app_lang: 'tr',
        },
        token,
        sipayBaseUrl
      );
      stripCardFields(result as Record<string, unknown>);
      if (result.invoice_id && result.invoice_id !== order.orderNumber) return { ok: true, status: 'failed' };
      if (result.currency_code && result.currency_code !== order.currency) return { ok: true, status: 'failed' };
      const amount = result.invoice_amount ?? result.amount;
      if (amount != null && !providerAmountMatches(amount, order.amountMinor)) return { ok: true, status: 'failed' };
      if (result.status_code === 100 && result.transaction_status === 'Completed') {
        return { ok: true, status: 'paid', providerPaymentId: String(result.transaction_id ?? result.order_id ?? '') };
      }
      if (result.transaction_status === 'Pending') return { ok: true, status: 'processing' };
      return { ok: true, status: 'failed' };
    } catch {
      return { ok: false, message: 'Ödeme sonucu doğrulanamadı.' };
    }
  }
}

export const QnbpayPaymentProvider = QnbPayService;

function normalizeInstallment(value?: number): number {
  const allowed = merchantInstallmentCounts();
  const requested = Number(value ?? 1);
  if (!allowed.includes(requested)) return 1;
  return requested;
}

async function sipayPost<T>(path: string, payload: Record<string, unknown>, token?: string, baseUrl?: string): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${baseUrl ?? qnbpayConfig().sipayBaseUrl}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  const text = await response.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error('qnbpay_invalid_response');
  }
}

async function sipayAccessToken(): Promise<string | null> {
  const { appId, appSecret, sipayBaseUrl } = qnbpayConfig();
  const result = await sipayPost<{ data?: { token?: string } }>(
    '/ccpayment/api/token',
    { app_id: appId, app_secret: appSecret, app_lang: 'tr' },
    undefined,
    sipayBaseUrl
  );
  return result.data?.token ?? null;
}

export async function qnbpayGetPos(input: { bin: string; amount: number; currency: string }) {
  const config = qnbpayConfig();
  if (!config.sipayConfigured) return { ok: false as const, message: 'BIN/taksit sorgusu için Sipay merchant_key gerekir.' };
  const token = await sipayAccessToken();
  if (!token) return { ok: false as const, message: 'QNBpay oturumu açılamadı.' };
  const result = await sipayPost<{
    status_code?: number;
    data?: Array<{
      installments_number?: number;
      card_program?: string;
      card_scheme?: string;
      card_bank?: string;
      payable_amount?: number;
      amount_to_be_paid?: string;
      title?: string;
    }>;
  }>(
    '/ccpayment/api/getpos',
    {
      credit_card: input.bin,
      amount: input.amount,
      currency_code: input.currency,
      merchant_key: config.merchantKey,
      app_lang: 'tr',
    },
    token,
    config.sipayBaseUrl
  );
  if (result.status_code !== 100 || !result.data) return { ok: false as const, message: 'Taksit bilgisi alınamadı.' };
  return { ok: true as const, options: result.data };
}

export async function qnbpayHealth(): Promise<{
  status: 'READY' | 'MISSING_CREDENTIALS' | 'DISABLED' | 'UNREACHABLE';
  env: string;
  mode: string;
  sipay: boolean;
  payfor: boolean;
}> {
  const config = qnbpayConfig();
  const env = process.env.PAYMENT_ENV === 'production' ? 'production' : 'test';
  if (!config.enabled) return { status: 'DISABLED', env, mode: config.mode, sipay: false, payfor: false };
  if (!config.configured) {
    return { status: 'MISSING_CREDENTIALS', env, mode: config.mode, sipay: config.sipayConfigured, payfor: config.payforConfigured };
  }
  if (config.mode === 'sipay') {
    try {
      const token = await sipayAccessToken();
      return { status: token ? 'READY' : 'UNREACHABLE', env, mode: config.mode, sipay: true, payfor: config.payforConfigured };
    } catch {
      return { status: 'UNREACHABLE', env, mode: config.mode, sipay: true, payfor: config.payforConfigured };
    }
  }
  return { status: 'READY', env, mode: config.mode, sipay: config.sipayConfigured, payfor: true };
}
