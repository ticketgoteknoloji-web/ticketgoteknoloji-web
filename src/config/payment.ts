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

const TAMI_PLACEHOLDER = /BURAYA_|CHANGE_ME|PLACEHOLDER|TEST_VALUE|EXAMPLE/i;

export function isUsableTamiCredential(value: string | undefined): boolean {
  const trimmed = trim(value);
  if (!trimmed) return false;
  if (TAMI_PLACEHOLDER.test(trimmed)) return false;
  return true;
}

export function hasUsableTamiPosId(posId: string | undefined, merchantId?: string): boolean {
  if (!isUsableTamiCredential(posId)) return false;
  const merchant = trim(merchantId);
  if (merchant && trim(posId) === merchant) return false;
  return true;
}

/**
 * POS / Terminal ID. Never invent a value and never use merchant ID as POS.
 * TAMI_TERMINAL_ID is used only when TAMI_POS_ID is unset and the terminal value is a real credential.
 * An explicit empty TAMI_POS_ID= stays missing.
 */
export function resolveTamiPosId(
  posId: string | undefined = process.env.TAMI_POS_ID,
  terminalId: string | undefined = process.env.TAMI_TERMINAL_ID,
  merchantId: string | undefined = process.env.TAMI_MERCHANT_ID
): string {
  if (hasUsableTamiPosId(posId, merchantId)) return trim(posId);
  if (posId !== undefined) return '';
  if (terminalId !== undefined && hasUsableTamiPosId(terminalId, merchantId)) return trim(terminalId);
  return '';
}

export function paymentEnv(): PaymentEnvironment {
  const raw = (process.env.QNB_ENV || process.env.PAYMENT_ENV || 'test').trim().toLowerCase();
  return raw === 'production' || raw === 'prod' || raw === 'live' ? 'production' : 'test';
}

export function publicSiteUrl(): string {
  const fromPayment = trim(process.env.PAYMENT_PUBLIC_BASE_URL);
  if (fromPayment) return fromPayment.replace(/\/$/, '');
  const fromApp = trim(process.env.NEXT_PUBLIC_APP_URL);
  if (fromApp && !isLocalUrl(fromApp)) return fromApp.replace(/\/$/, '');
  const fromPublic = trim(process.env.NEXT_PUBLIC_SITE_URL);
  if (fromPublic && !isLocalUrl(fromPublic)) return fromPublic.replace(/\/$/, '');
  if (paymentEnv() === 'production') return BRAND_SITE_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL.replace(/\/$/, '')}`;
  if (fromApp) return fromApp.replace(/\/$/, '');
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
  const qnbpayEnabled = flag(process.env.QNBPAY_ENABLED, false);
  const tamiEnvRaw = (process.env.TAMI_ENV || 'sandbox').trim().toLowerCase();
  const tamiEnv = tamiEnvRaw === 'production' || tamiEnvRaw === 'prod' || tamiEnvRaw === 'live' ? 'production' : 'sandbox';
  const tamiSandboxBase =
    trim(process.env.TAMI_SANDBOX_BASE_URL) || 'https://sandbox-paymentapi.tami.com.tr';
  const tamiProductionBase =
    trim(process.env.TAMI_PRODUCTION_BASE_URL) || 'https://paymentapi.tami.com.tr';
  const tamiMerchantId = trim(process.env.TAMI_MERCHANT_ID);
  const tamiPosId = resolveTamiPosId();
  const tamiUsername = trim(process.env.TAMI_USERNAME) || trim(process.env.TAMI_KID) || trim(process.env.TAMI_JWK_KID);
  const tamiPassword = trim(process.env.TAMI_PASSWORD) || trim(process.env.TAMI_K) || trim(process.env.TAMI_JWK_K);
  const tamiSecretKey = trim(process.env.TAMI_SECRET_KEY);
  const tamiKidK = (() => {
    const password = tamiPassword;
    const pipe = password.indexOf('|');
    if (pipe >= 0) {
      return {
        kid: password.slice(0, pipe).trim() || tamiUsername,
        k: password.slice(pipe + 1).trim(),
      };
    }
    return { kid: tamiUsername, k: password };
  })();
  const tamiEnabled = flag(process.env.TAMI_ENABLED, true);
  const tamiConfigured = Boolean(
    tamiEnabled &&
      isUsableTamiCredential(tamiMerchantId) &&
      hasUsableTamiPosId(tamiPosId, tamiMerchantId) &&
      isUsableTamiCredential(tamiSecretKey) &&
      isUsableTamiCredential(tamiKidK.kid) &&
      isUsableTamiCredential(tamiKidK.k)
  );
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
    tami: {
      enabled: tamiEnabled,
      env: tamiEnv,
      baseUrl: tamiEnv === 'production' ? tamiProductionBase.replace(/\/$/, '') : tamiSandboxBase.replace(/\/$/, ''),
      merchantId: tamiMerchantId,
      posId: tamiPosId,
      username: tamiUsername,
      kid: tamiKidK.kid,
      k: tamiKidK.k,
      secretKey: tamiSecretKey,
      callbackUrl: trim(process.env.TAMI_CALLBACK_URL),
      configured: tamiConfigured,
    },
  } as const;
}

export function qnbpayConfig() {
  return getPaymentConfig().qnbpay;
}

export function tamiConfig() {
  return getPaymentConfig().tami;
}
