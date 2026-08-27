import { NextResponse } from 'next/server';
import { startCheckout } from '@/lib/payments/service';
import { publicBaseUrl, qnbpayConfig, tamiConfig } from '@/lib/payments/config';
import { cardNumberValid, cvvValid, detectCardNetwork, digitsOnly, expiryValid } from '@/lib/payments/card-ui';
import { clientIp, originAllowed, paymentLog, rateLimit, stripCardFields } from '@/lib/payments/security';
import type { PaymentCard, PaymentCustomer, PaymentProviderId } from '@/lib/payments/types';
import type { PaymentPeriod } from '@/lib/commerce';

function readString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function isLocalHostUrl(value: string): boolean {
  try {
    const host = new URL(value).hostname;
    return host === 'localhost' || host === '127.0.0.1';
  } catch {
    return false;
  }
}

function missingQnbEnvNames(): string[] {
  const missing: string[] = [];
  const need = (name: string, value: string | undefined) => {
    if (!value?.trim()) missing.push(name);
  };
  const cfg = qnbpayConfig();
  if (cfg.mode === 'sipay' || (!cfg.payforConfigured && !cfg.sipayConfigured)) {
    need('QNBPAY_APP_ID', process.env.QNBPAY_APP_ID);
    need('QNBPAY_APP_SECRET', process.env.QNBPAY_APP_SECRET);
    need('QNBPAY_MERCHANT_KEY', process.env.QNBPAY_MERCHANT_KEY);
  }
  if (cfg.mode === 'payfor' || (!cfg.payforConfigured && !cfg.sipayConfigured)) {
    need('QNBPAY_MERCHANT_ID', process.env.QNBPAY_MERCHANT_ID);
    need('QNBPAY_USER_CODE', process.env.QNBPAY_USER_CODE);
    need('QNBPAY_PASSWORD', process.env.QNBPAY_PASSWORD);
    need('QNBPAY_STORE_KEY', process.env.QNBPAY_STORE_KEY);
  }
  return [...new Set(missing)];
}

function missingTamiEnvNames(): string[] {
  const missing: string[] = [];
  const need = (name: string, value: string | undefined) => {
    if (!value?.trim()) missing.push(name);
  };
  const cfg = tamiConfig();
  need('TAMI_MERCHANT_ID', process.env.TAMI_MERCHANT_ID);
  need('TAMI_POS_ID', process.env.TAMI_POS_ID || process.env.TAMI_TERMINAL_ID);
  need('TAMI_USERNAME', cfg.kid);
  need('TAMI_PASSWORD', cfg.k);
  need('TAMI_SECRET_KEY', process.env.TAMI_SECRET_KEY);
  return [...new Set(missing)];
}

function readCard(raw: Record<string, unknown>): PaymentCard | undefined {
  const source = raw.card;
  if (!source || typeof source !== 'object' || Array.isArray(source)) return undefined;
  const card = source as Record<string, unknown>;
  const holderName = readString(card.holderName || card.holder);
  const number = digitsOnly(readString(card.number));
  const expireMonth = digitsOnly(readString(card.expireMonth));
  const expireYear = digitsOnly(readString(card.expireYear));
  const cvv = digitsOnly(readString(card.cvv));
  const expiry = `${expireMonth.padStart(2, '0')}${expireYear.slice(-2)}`;
  if (!holderName || !cardNumberValid(number) || !expiryValid(expiry) || !cvvValid(cvv, detectCardNetwork(number))) {
    return undefined;
  }
  return {
    holderName,
    number,
    expireMonth: expireMonth.padStart(2, '0').slice(-2),
    expireYear: expireYear.length === 2 ? `20${expireYear}` : expireYear.slice(0, 4),
    cvv,
  };
}

export async function handleCreatePayment(request: Request, provider: PaymentProviderId) {
  if (request.method !== 'POST') {
    return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
  }
  if (!originAllowed(request.headers)) {
    return NextResponse.json({ error: 'Origin doğrulanamadı.' }, { status: 403 });
  }
  const ip = clientIp(request.headers);
  if (!rateLimit(`pay:${ip}:${provider}`)) {
    return NextResponse.json({ error: 'Çok fazla deneme. Lütfen sonra tekrar deneyin.' }, { status: 429 });
  }

  let raw: Record<string, unknown>;
  try {
    raw = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 400 });
  }

  const card = provider === 'tami' ? readCard(raw) : undefined;
  if (provider === 'tami' && !card) {
    return NextResponse.json({ error: 'Kart bilgilerini kontrol edin.' }, { status: 400 });
  }
  const body = stripCardFields(raw);

  if (
    body.price != null ||
    body.amount != null ||
    body.total != null ||
    body.discount != null ||
    body.paidPrice != null ||
    body.rate != null ||
    body.exchangeRate != null ||
    body.tryAmount != null ||
    body.paymentAmount != null ||
    body.chargedAmount != null ||
    body.usdTryRate != null
  ) {
    paymentLog('price_tamper_ignored', { provider });
  }

  const customer = stripCardFields((body.customer ?? {}) as Record<string, unknown>);
  const periodRaw = readString(body.period);
  const period = (periodRaw === 'monthly' || periodRaw === 'annual' || periodRaw === 'once' ? periodRaw : 'monthly') as PaymentPeriod;
  const productId = readString(body.productId);
  const orderId = readString(body.orderId);
  if (!productId && !orderId) {
    return NextResponse.json({ error: 'Ürün veya sipariş bilgisi gerekli.' }, { status: 400 });
  }

  try {
    const result = await startCheckout({
      productId: productId || undefined,
      orderId: orderId || undefined,
      period,
      quantity: Number(body.quantity ?? 1),
      provider,
      ip,
      request,
      idempotencyKey: readString(body.idempotencyKey),
      installment: Number(body.installment ?? 1),
      cardProgram: readString(body.cardProgram) || undefined,
      card,
      legalAccepted: body.legalAccepted === true,
      marketingOptIn: body.marketingOptIn === true,
      distanceSalesVersion: readString(body.distanceSalesVersion),
      preInformationVersion: readString(body.preInformationVersion),
      customer: {
        firstName: readString(customer.firstName),
        lastName: readString(customer.lastName),
        email: readString(customer.email),
        phone: readString(customer.phone),
        identityNumber: readString(customer.identityNumber),
        company: readString(customer.company) || undefined,
        taxOffice: readString(customer.taxOffice) || undefined,
        address: readString(customer.address),
        city: readString(customer.city),
        country: 'Turkey',
        zipCode: readString(customer.zipCode) || undefined,
        billingType: customer.billingType === 'company' ? 'company' : 'individual',
      } satisfies PaymentCustomer,
    });
    if (!result.configured) {
      paymentLog('payment_create_not_configured', { provider, orderNumber: result.order.orderNumber });
      return NextResponse.json({
        configured: false,
        message: result.message,
        orderNumber: result.order.orderNumber,
        missingEnv: provider === 'tami' ? missingTamiEnvNames() : missingQnbEnvNames(),
        callbackLocal: isLocalHostUrl(publicBaseUrl(request)),
      });
    }
    if (!result.redirectUrl) {
      return NextResponse.json(
        {
          configured: true,
          message: result.message,
          orderNumber: result.order.orderNumber,
          callbackLocal: isLocalHostUrl(publicBaseUrl(request)),
        },
        { status: 502 }
      );
    }
    return NextResponse.json({
      configured: true,
      redirectUrl: result.redirectUrl,
      orderNumber: result.order.orderNumber,
      callbackLocal: isLocalHostUrl(publicBaseUrl(request)),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Ödeme başlatılamadı.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
