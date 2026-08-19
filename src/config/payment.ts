import { BRAND_SITE_URL } from '@/lib/site';

export type PaymentEnvironment = 'test' | 'production';

function trim(value: string | undefined): string {
  return value?.trim() ?? '';
}

function isLocalUrl(value: string): boolean {
  try {
    const host = new URL(value).hostname;
    return host === 'localhost' || host === '127.0.0.1';
  } catch {
    return false;
  }
}

function flag(value: string | undefined, fallback = true): boolean {
  if (value == null || value === '') return fallback;
  return value !== '0' && value.toLowerCase() !== 'false' && value.toLowerCase() !== 'off';
}

export function paymentEnv(): PaymentEnvironment {
  const raw = (process.env.QNB_ENV || process.env.PAYMENT_ENV || 'test').trim().toLowerCase();
  return raw === 'production' || raw === 'prod' || raw === 'live' ? 'production' : 'test';
}

export function publicSiteUrl(): string {
  const fromPayment = trim(process.env.PAYMENT_PUBLIC_BASE_URL);
  if (fromPayment) return fromPayment.replace(/\/$/, '');
  const fromPublic = trim(process.env.NEXT_PUBLIC_SITE_URL);
  if (fromPublic && !isLocalUrl(fromPublic)) return fromPublic.replace(/\/$/, '');
  if (paymentEnv() === 'production') return BRAND_SITE_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL.replace(/\/$/, '')}`;
  if (fromPublic) return fromPublic.replace(/\/$/, '');
  return 'http://localhost:3001';
}

export function getPaymentConfig() {
  const env = paymentEnv();
  const qnbAppId = trim(process.env.QNBPAY_APP_ID);
  const qnbAppSecret = trim(process.env.QNBPAY_APP_SECRET);
  const qnbMerchantKey = trim(process.env.QNBPAY_MERCHANT_KEY);
  const qnbMerchantId = trim(process.env.QNBPAY_MERCHANT_ID);
  const qnbUserCode = trim(process.env.QNBPAY_USER_CODE);
  const qnbPassword = trim(process.env.QNBPAY_PASSWORD);
  const qnbStoreKey = trim(process.env.QNBPAY_STORE_KEY);
  const qnbMbrId = trim(process.env.QNBPAY_MBR_ID) || '5';
  const sipayBaseUrl =
    trim(process.env.QNBPAY_SIPAY_BASE_URL) ||
    trim(process.env.QNBPAY_BASE_URL) ||
    (env === 'production' ? 'https://app.sipay.com.tr' : 'https://provisioning.sipay.com.tr');
  const payfor3DHostUrl =
    trim(process.env.QNBPAY_GATEWAY_URL) ||
    (env === 'production'
      ? 'https://vpos.qnb.com.tr/Gateway/3DHost.aspx'
      : 'https://vpostest.qnb.com.tr/Gateway/3DHost.aspx');
  const payforApiUrl =
    trim(process.env.QNBPAY_API_URL) ||
    (env === 'production'
      ? 'https://vpos.qnb.com.tr/Gateway/Default.aspx'
      : 'https://vpostest.qnb.com.tr/Gateway/Default.aspx');
  const qnbpayEnabled = flag(process.env.QNBPAY_ENABLED, true);
  const sipayConfigured = Boolean(qnbAppId && qnbAppSecret && qnbMerchantKey);
  const payforConfigured = Boolean(qnbMerchantId && qnbUserCode && qnbPassword && qnbStoreKey);
  const mode = payforConfigured ? 'payfor' : sipayConfigured ? 'sipay' : 'none';

  return {
    env,
    siteUrl: publicSiteUrl(),
    production: env === 'production',
    testMode: env !== 'production',
    qnbpay: {
      enabled: qnbpayEnabled,
      mode,
      appId: qnbAppId,
      appSecret: qnbAppSecret,
      merchantKey: qnbMerchantKey,
      merchantId: qnbMerchantId,
      userCode: qnbUserCode,
      password: qnbPassword,
      storeKey: qnbStoreKey,
      mbrId: qnbMbrId,
      sipayBaseUrl,
      payfor3DHostUrl,
      payforApiUrl,
      payforGatewayUrl: payfor3DHostUrl,
      baseUrl: mode === 'payfor' ? payfor3DHostUrl : sipayBaseUrl,
      sipayConfigured,
      payforConfigured,
      configured: qnbpayEnabled && (sipayConfigured || payforConfigured),
    },
  } as const;
}

export function qnbpayConfig() {
  return getPaymentConfig().qnbpay;
}
