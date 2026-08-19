import { createHash, timingSafeEqual } from 'crypto';
import { formatProviderMoney, providerAmountMatches } from '@/lib/payments/amount';
import { qnbpayConfig } from '@/lib/payments/config';
import { hmacEquals, hmacSign, paymentLog } from '@/lib/payments/security';
import type { OrderRecord, VerifyPaymentResult } from '@/lib/payments/types';

const ISO_CURRENCY: Record<string, string> = {
  TRY: '949',
  TL: '949',
  USD: '840',
  EUR: '978',
  GBP: '826',
};

/** Official QNB request hash: SHA1(ASCII) then Base64. */
export function payforSha1Base64(value: string): string {
  return createHash('sha1').update(value, 'ascii').digest('base64');
}

export function payforCurrencyCode(currency: string): string {
  return ISO_CURRENCY[currency.toUpperCase()] ?? currency;
}

export function payforAmount(minor: number): string {
  return formatProviderMoney(minor);
}

export function payforRequestHash(input: {
  mbrId: string;
  orderId: string;
  amount: string;
  okUrl: string;
  failUrl: string;
  txnType: string;
  installmentCount: string;
  rnd: string;
  storeKey: string;
}): string {
  return payforSha1Base64(
    input.mbrId +
      input.orderId +
      input.amount +
      input.okUrl +
      input.failUrl +
      input.txnType +
      input.installmentCount +
      input.rnd +
      input.storeKey
  );
}

export function payforResponseHash(input: {
  merchantId: string;
  storeKey: string;
  orderId: string;
  authCode: string;
  procReturnCode: string;
  threeDStatus: string;
  responseRnd: string;
  userCode: string;
}): string {
  return payforSha1Base64(
    input.merchantId +
      input.storeKey +
      input.orderId +
      input.authCode +
      input.procReturnCode +
      input.threeDStatus +
      input.responseRnd +
      input.userCode
  );
}

export function hashesMatch(expected: string, actual: string): boolean {
  if (!expected || !actual) return false;
  try {
    return hmacEquals(expected, actual);
  } catch {
    const a = Buffer.from(expected);
    const b = Buffer.from(actual);
    return a.length === b.length && timingSafeEqual(a, b);
  }
}

export function build3DHostFields(input: {
  order: OrderRecord;
  okUrl: string;
  failUrl: string;
  installment: number;
}): { gatewayUrl: string; fields: Record<string, string> } {
  const config = qnbpayConfig();
  const amount = payforAmount(input.order.amountMinor);
  const installmentCount = input.installment > 1 ? String(input.installment) : '0';
  const rnd = `${Date.now()}`;
  const orderId = input.order.orderNumber.slice(0, 36);
  const fields = {
    MbrId: config.mbrId,
    MerchantID: config.merchantId,
    UserCode: config.userCode,
    UserPass: config.password,
    SecureType: '3DHost',
    TxnType: 'Auth',
    InstallmentCount: installmentCount,
    Currency: payforCurrencyCode(input.order.currency),
    OkUrl: input.okUrl,
    FailUrl: input.failUrl,
    OrderId: orderId,
    PurchAmount: amount,
    Lang: 'TR',
    Rnd: rnd,
    Hash: payforRequestHash({
      mbrId: config.mbrId,
      orderId,
      amount,
      okUrl: input.okUrl,
      failUrl: input.failUrl,
      txnType: 'Auth',
      installmentCount,
      rnd,
      storeKey: config.storeKey,
    }),
  };
  return { gatewayUrl: config.payfor3DHostUrl || config.payforGatewayUrl, fields };
}

export function verifyPayforCallback(order: OrderRecord, payload: Record<string, string>): VerifyPaymentResult {
  const config = qnbpayConfig();
  const orderId = payload.OrderId || payload.orderId || '';
  if (orderId && orderId !== order.orderNumber && orderId !== order.id) {
    paymentLog('qnb_payfor_order_mismatch', { orderNumber: order.orderNumber });
    return { ok: true, status: 'failed' };
  }
  const responseHash = payload.ResponseHash || payload.responseHash || '';
  const expected = payforResponseHash({
    merchantId: config.merchantId,
    storeKey: config.storeKey,
    orderId: orderId || order.orderNumber,
    authCode: payload.AuthCode || '',
    procReturnCode: payload.ProcReturnCode || '',
    threeDStatus: payload['3DStatus'] || payload.ThreeDStatus || payload.DStatus || '',
    responseRnd: payload.ResponseRnd || payload.Rnd || '',
    userCode: config.userCode,
  });
  if (!hashesMatch(expected, responseHash)) {
    paymentLog('qnb_payfor_hash_invalid', { orderNumber: order.orderNumber });
    return { ok: true, status: 'failed' };
  }
  const merchant = payload.MerchantID || payload.MerchantId || '';
  if (merchant && merchant !== config.merchantId) {
    paymentLog('qnb_payfor_merchant_mismatch', { orderNumber: order.orderNumber });
    return { ok: true, status: 'failed' };
  }
  const amount = payload.PurchAmount || payload.Amount;
  if (amount && !providerAmountMatches(amount.replace(',', '.'), order.amountMinor)) {
    paymentLog('qnb_payfor_amount_mismatch', { orderNumber: order.orderNumber });
    return { ok: true, status: 'failed' };
  }
  const currency = payload.Currency;
  const expectedCurrency = payforCurrencyCode(order.currency);
  if (currency && currency !== expectedCurrency && currency !== order.currency) {
    paymentLog('qnb_payfor_currency_mismatch', { orderNumber: order.orderNumber });
    return { ok: true, status: 'failed' };
  }
  const threeD = (payload['3DStatus'] || payload.ThreeDStatus || '').toUpperCase();
  if (threeD && threeD !== '1' && threeD !== 'Y' && threeD !== 'A') {
    return { ok: true, status: 'failed' };
  }
  if (payload.ProcReturnCode === '00') {
    return {
      ok: true,
      status: 'paid',
      providerPaymentId: payload.TransId || payload.HostRefNum || payload.AuthCode,
      paymentTransactionId: payload.TransId || payload.RequestGuid,
      conversationId: orderId || order.orderNumber,
    };
  }
  return { ok: true, status: 'failed' };
}

async function payforXmlPost(fields: Record<string, string>): Promise<Record<string, string>> {
  const config = qnbpayConfig();
  const body = new URLSearchParams(fields);
  const response = await fetch(config.payforApiUrl || config.payforGatewayUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const text = await response.text();
  const result: Record<string, string> = {};
  for (const match of text.matchAll(/<(\w+)>([^<]*)<\/\1>/g)) {
    result[match[1]] = match[2];
  }
  if (Object.keys(result).length === 0) {
    new URLSearchParams(text).forEach((value, key) => {
      result[key] = value;
    });
  }
  return result;
}

export async function payforAdminTxn(
  order: OrderRecord,
  txnType: 'Refund' | 'Void',
  amountMinor?: number
): Promise<{ ok: boolean; message: string; code?: string }> {
  const config = qnbpayConfig();
  if (!config.payforConfigured) return { ok: false, message: 'PayFor üye işyeri bilgileri yok.' };
  const fields: Record<string, string> = {
    MbrId: config.mbrId,
    MerchantID: config.merchantId,
    UserCode: config.userCode,
    UserPass: config.password,
    OrderId: order.orderNumber.slice(0, 36),
    SecureType: 'NonSecure',
    TxnType: txnType,
    Currency: payforCurrencyCode(order.currency),
    Lang: 'TR',
  };
  if (txnType === 'Refund') fields.PurchAmount = payforAmount(amountMinor ?? order.amountMinor);
  const result = await payforXmlPost(fields);
  paymentLog('qnb_payfor_admin_txn', { orderNumber: order.orderNumber, txnType, code: result.ProcReturnCode });
  if (result.ProcReturnCode === '00') return { ok: true, message: `${txnType} tamamlandı.`, code: result.ProcReturnCode };
  return { ok: false, message: 'QNB işlem reddedildi.', code: result.ProcReturnCode };
}

export function launchToken(attemptId: string, orderId: string): string {
  return hmacSign(`${attemptId}:${orderId}`);
}
