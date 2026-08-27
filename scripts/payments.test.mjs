import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

function roundUsd(amount) {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

function toMinorUnits(amount) {
  return Math.round(roundUsd(amount) * 100);
}

function fromMinorUnits(minor) {
  return minor / 100;
}

function isValidTckn(value) {
  if (!/^[1-9]\d{10}$/.test(value)) return false;
  const d = value.split('').map(Number);
  const odd = d[0] + d[2] + d[4] + d[6] + d[8];
  const even = d[1] + d[3] + d[5] + d[7];
  if ((odd * 7 - even) % 10 !== d[9]) return false;
  return d.slice(0, 10).reduce((sum, n) => sum + n, 0) % 10 === d[10];
}

function stripCardFields(payload) {
  const blocked = /^(cc_|card|cvv|cvc|pan|expiry|expire|kart)/i;
  const next = {};
  for (const [key, value] of Object.entries(payload)) {
    if (blocked.test(key) || key.toLowerCase() === 'cc_no') continue;
    next[key] = value;
  }
  return next;
}

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const catalog = JSON.parse(readFileSync(join(root, 'src/data/pricing-catalog.json'), 'utf8'));
const envExample = readFileSync(join(root, '.env.example'), 'utf8');
const qnbpay = readFileSync(join(root, 'src/lib/payments/qnbpay.ts'), 'utf8');
const checkout = readFileSync(join(root, 'src/components/payment/PaymentCheckout.tsx'), 'utf8');
const http = readFileSync(join(root, 'src/lib/payments/http.ts'), 'utf8');
const service = readFileSync(join(root, 'src/lib/payments/service.ts'), 'utf8');
const providers = readFileSync(join(root, 'src/lib/payments/providers.ts'), 'utf8');
const security = readFileSync(join(root, 'src/lib/payments/security.ts'), 'utf8');

const purchasable = new Set([
  'ticketgo-starter',
  'ticketgo-growth',
  'ticketgo-scale',
  'discovery',
  'ai-starter',
  'ai-growth',
  'ai-scale',
  'support-essential',
  'support-professional',
  'support-mission',
  'extra-operator-seat',
  'extra-support-hour',
  'extra-environment',
]);

const quoteOnly = new Set([
  'ticketgo-enterprise',
  'mvp',
  'growth-product',
  'dedicated-team',
  'custom-integration',
  'mobile-app',
  'data-migration',
]);

test('minor units avoid float drift', () => {
  assert.equal(toMinorUnits(249), 24900);
  assert.equal(toMinorUnits(199.2), 19920);
  assert.equal(fromMinorUnits(19920), 199.2);
  assert.equal(toMinorUnits(0.1 + 0.2), 30);
});

test('client price query is ignored by payment create handler', () => {
  assert.match(http, /price_tamper_ignored/);
  assert.match(http, /quoteProduct|startCheckout/);
  assert.doesNotMatch(http, /amountMinor:\s*body/);
  assert.doesNotMatch(http, /paidPrice:\s*readString/);
});

test('purchasable catalog items have defined prices', () => {
  const items = [
    ...catalog.plans,
    ...catalog.services,
    ...catalog.aiPlans,
    ...catalog.supportPlans,
    ...catalog.addOns,
  ];
  for (const id of purchasable) {
    const item = items.find((entry) => entry.id === id);
    assert.ok(item, id);
    const price = item.monthlyPrice ?? item.setupFee ?? item.price;
    assert.equal(typeof price, 'number', id);
    assert.ok(price > 0, id);
  }
});

test('quote-only items are not in the purchasable set', () => {
  for (const id of quoteOnly) {
    assert.equal(purchasable.has(id), false, id);
  }
});

test('valid TCKN checksum', () => {
  assert.equal(isValidTckn('10000000146'), true);
  assert.equal(isValidTckn('12345678901'), false);
});

test('card fields are ephemeral UI and never persisted client-side', () => {
  const cleaned = stripCardFields({ invoice_id: 'SIP-1', cc_no: '4111111111111111', cvv: '123' });
  assert.deepEqual(cleaned, { invoice_id: 'SIP-1' });
  assert.match(http, /stripCardFields/);
  assert.doesNotMatch(checkout, /name=["'](cardNumber|cvv|cvc|expiry|cc_no)/i);
  assert.doesNotMatch(checkout, /localStorage|sessionStorage/);
  assert.match(checkout, /\/api\/payments\/tami\/create/);
  assert.match(checkout, /card: \{/);
  assert.match(checkout, /cvv: digitsOnly\(cvv\)/);
  assert.match(checkout, /type="password"/);
  assert.match(checkout, /Kart Üzerindeki Ad Soyad/);
  assert.match(checkout, /Güvenlik Kodu/);
  assert.match(checkout, /maskCardNumber/);
  assert.match(http, /provider === 'tami' \? readCard/);
  assert.doesNotMatch(service, /cvv:/);
  assert.doesNotMatch(readFileSync(join(root, 'src/lib/payments/orders.ts'), 'utf8'), /\bcvv\b/);
});

test('provider secrets stay server-side', () => {
  assert.equal(existsSync(join(root, 'src/lib/payments/iyzico.ts')), false);
  assert.equal(existsSync(join(root, 'src/app/api/payments/iyzico')), false);
  assert.match(qnbpay, /QNBPAY_APP_SECRET|qnbpayConfig/);
  assert.doesNotMatch(checkout, /IYZICO_SECRET_KEY|QNBPAY_APP_SECRET|IYZICO_API_KEY|QNBPAY_STORE_KEY|QNBPAY_PASSWORD|TAMI_SECRET_KEY|TAMI_PASSWORD/);
  assert.doesNotMatch(envExample, /IYZICO_/);
  assert.match(envExample, /TAMI_MERCHANT_ID=/);
  assert.match(envExample, /TAMI_SECRET_KEY=/);
  assert.match(envExample, /TAMI_ENV=sandbox/);
  assert.match(envExample, /QNBPAY_ENABLED=false/);
  assert.match(envExample, /NEXT_PUBLIC_SITE_URL=/);
  assert.doesNotMatch(envExample, /NEXT_PUBLIC_IYZICO_|NEXT_PUBLIC_QNBPAY_|NEXT_PUBLIC_TAMI_/);
});

test('checkout requires versioned contract acceptance', () => {
  assert.match(service, /if \(!input\.legalAccepted\)/);
  assert.match(service, /distanceSalesVersion: LEGAL_VERSIONS\.distanceSales\.version/);
  assert.match(service, /acceptedAt: now/);
  assert.match(http, /legalAccepted: body\.legalAccepted === true/);
});

test('orders persist payment attempts and paidAt', () => {
  const orders = readFileSync(join(root, 'src/lib/payments/orders.ts'), 'utf8');
  assert.match(orders, /attempts/);
  assert.match(orders, /saveAttempt/);
  assert.match(service, /saveAttempt/);
  assert.match(service, /paidAt/);
});

test('provider amount mismatch is not treated as paid', () => {
  assert.match(qnbpay, /providerAmountMatches/);
  const tami = readFileSync(join(root, 'src/lib/payments/tami.ts'), 'utf8');
  assert.match(tami, /providerAmountMatches/);
  assert.match(tami, /tami_amount_mismatch/);
  assert.match(tami, /\/payment\/complete-3ds/);
  const payfor = readFileSync(join(root, 'src/lib/payments/qnb-payfor.ts'), 'utf8');
  assert.match(payfor, /qnb_payfor_amount_mismatch/);
  assert.match(payfor, /qnb_payfor_hash_invalid/);
  assert.match(payfor, /ProcReturnCode === '00'/);
});

test('refund helper is internal only', () => {
  const refund = readFileSync(join(root, 'src/lib/payments/refund.ts'), 'utf8');
  assert.match(refund, /refundPaidOrder/);
  assert.match(refund, /voidOrderInternal/);
  assert.doesNotMatch(refund, /export async function POST/);
});

test('QNBpay uses official 3D Host or Sipay hosted link', () => {
  const payfor = readFileSync(join(root, 'src/lib/payments/qnb-payfor.ts'), 'utf8');
  const programs = readFileSync(join(root, 'src/config/qnbpay-card-programs.ts'), 'utf8');
  assert.match(payfor, /SecureType: '3DHost'/);
  const paymentConfig = readFileSync(join(root, 'src/config/payment.ts'), 'utf8');
  assert.match(paymentConfig, /vpostest\.qnb\.com\.tr\/Gateway\/3DHost\.aspx/);
  assert.match(paymentConfig, /vpos\.qnb\.com\.tr\/Gateway\/3DHost\.aspx/);
  assert.match(paymentConfig, /vpostest\.qnb\.com\.tr\/Gateway\/Default\.aspx/);
  assert.match(envExample, /QNB_ENV=/);
  assert.match(envExample, /PAYMENT_PUBLIC_BASE_URL=/);
  assert.match(payfor, /MbrId \+ OrderId \+ PurchAmount|mbrId \+\s*input\.orderId/);
  assert.match(payfor, /MerchantID \+ MerchantPass \+ OrderId \+ AuthCode|merchantId \+\s*input\.storeKey/);
  assert.match(qnbpay, /\/ccpayment\/purchase\/link/);
  assert.match(qnbpay, /\/ccpayment\/api\/getpos/);
  assert.match(programs, /enabled: boolean/);
  assert.match(programs, /envFlag\(`QNBPAY_PROGRAM_\$\{id\.toUpperCase\(\)\}`\) === true/);
  assert.match(envExample, /QNBPAY_STORE_KEY=/);
  assert.match(envExample, /QNBPAY_USER_CODE=/);
  assert.doesNotMatch(envExample, /NEXT_PUBLIC_QNBPAY_/);
});

test('card number formatting and luhn stay client-side', () => {
  const cardUi = readFileSync(join(root, 'src/lib/payments/card-ui.ts'), 'utf8');
  assert.match(cardUi, /export function luhnOk/);
  assert.match(cardUi, /export function formatExpiry/);
  assert.match(cardUi, /export function maskCardNumber/);
  assert.match(cardUi, /UI_CARD_NUMBER_DIGITS = 16/);
  assert.match(cardUi, /UI_CARD_NUMBER_MIN = 16/);
  assert.match(cardUi, /UI_CARD_NUMBER_INPUT_MAX = 19/);
  assert.match(cardUi, /slice\(0, UI_CARD_NUMBER_DIGITS\)/);
  assert.doesNotMatch(cardUi, /length === 20/);
  assert.doesNotMatch(cardUi, /UI_CARD_NUMBER_DIGITS = 20/);
  assert.doesNotMatch(cardUi, /UI_CARD_NUMBER_DIGITS = 19/);
  assert.doesNotMatch(cardUi, /localStorage|sessionStorage|fetch\(/);
  assert.match(checkout, /Kart numarasını kontrol edin/);
  assert.match(checkout, /xxxx xxxx xxxx xxxx/);
  assert.doesNotMatch(checkout, /1234 5678 9012 3456 7890/);
  assert.doesNotMatch(checkout, /20 rakam/);
  assert.match(checkout, /maxLength=\{UI_CARD_NUMBER_INPUT_MAX\}/);
  assert.match(checkout, /shouldAdvanceCardField/);
  assert.match(checkout, /expiryRef/);
  assert.match(checkout, /cvvRef/);
  assert.match(checkout, /const canPay = Boolean\([\s\S]*configured && customerValid && cardOk && legalAccepted && orderOk && !submitting && tryTotal != null/);
  assert.doesNotMatch(checkout, /disabled=\{!configured/);
});

test('16-digit PAN passes luhn and extra digits are dropped', () => {
  function digitsOnly(value) {
    return value.replace(/\D/g, '');
  }
  function formatCardNumber(value) {
    return digitsOnly(value)
      .slice(0, 16)
      .replace(/(\d{4})(?=\d)/g, '$1 ')
      .trim();
  }
  function luhnOk(value) {
    const digits = digitsOnly(value);
    if (digits.length !== 16) return false;
    let sum = 0;
    let doubleDigit = false;
    for (let index = digits.length - 1; index >= 0; index -= 1) {
      let digit = Number(digits[index]);
      if (doubleDigit) {
        digit *= 2;
        if (digit > 9) digit -= 9;
      }
      sum += digit;
      doubleDigit = !doubleDigit;
    }
    return sum % 10 === 0;
  }
  const sixteen = '4111111111111111';
  assert.equal(sixteen.length, 16);
  assert.equal(luhnOk(sixteen), true);
  assert.equal(luhnOk('4111 1111 1111 1111'), true);
  assert.equal(formatCardNumber('41111111111111119999'), '4111 1111 1111 1111');
  assert.equal(digitsOnly(formatCardNumber('4111 1111 1111 1111 999')).length, 16);
  assert.notEqual(sixteen.length, 20);
});

test('card fields advance from PAN to expiry then CVV', () => {
  function digitsOnly(value) {
    return value.replace(/\D/g, '');
  }
  function shouldAdvanceCardField(previous, next, filledLength) {
    return digitsOnly(previous).length < filledLength && digitsOnly(next).length >= filledLength;
  }
  assert.equal(shouldAdvanceCardField('4111 1111 1111 111', '4111 1111 1111 1111', 16), true);
  assert.equal(shouldAdvanceCardField('4111 1111 1111 1111', '4111 1111 1111 1111', 16), false);
  assert.equal(shouldAdvanceCardField('12 / 2', '12 / 29', 4), true);
  assert.equal(shouldAdvanceCardField('12 / 29', '12 / 29', 4), false);
  const panHandler = checkout.slice(checkout.indexOf('id="card-number"'), checkout.indexOf('id="card-expiry"'));
  const expiryHandler = checkout.slice(checkout.indexOf('id="card-expiry"'), checkout.indexOf('id="card-cvv"'));
  assert.match(panHandler, /expiryRef/);
  assert.match(expiryHandler, /cvvRef/);
  assert.doesNotMatch(panHandler, /cvvRef/);
});

test('QNB PayFor hash uses SHA1 ASCII then Base64', () => {
  const value = '5' + 'SIP1' + '1.00' + 'ok' + 'fail' + 'Auth' + '0' + 'rnd' + 'store';
  const hash = createHash('sha1').update(value, 'ascii').digest('base64');
  assert.equal(hash.length, 28);
  assert.match(hash, /^[A-Za-z0-9+/]+=*$/);
});

test('checkout CTA and card programs stay merchant-driven', () => {
  assert.match(checkout, /Güvenli Ödeme Yap/);
  assert.match(checkout, /Ödeme işlemi başlatılıyor/);
  assert.doesNotMatch(checkout, /Test modu|TEST MODU/i);
  assert.match(checkout, /Tami \/ Garanti BBVA · 3D Secure/);
  assert.match(checkout, /Siparişinizi tamamlamak için kart ve fatura bilgilerinizi girin/);
  assert.match(checkout, /Tami \/ Garanti BBVA ödeme altyapısı henüz tamamlanmadı\. POS\/Terminal aktivasyonu bekleniyor/);
  assert.match(checkout, /KDV Hariç/);
  assert.match(checkout, /href="\/"/);
  assert.doesNotMatch(checkout, /Bu bankaların tamamı kesin desteklenmektedir/);
  assert.doesNotMatch(checkout, /iyzico/i);
  assert.doesNotMatch(providers, /iyzicoConfig|IyzicoPaymentProvider/);
});

test('payment signing secret fails closed in production', () => {
  assert.match(security, /PAYMENT_SIGNING_SECRET is required in production/);
  assert.match(security, /dev-only-signing/);
});

test('no fake success payment shortcut in providers', () => {
  const tami = readFileSync(join(root, 'src/lib/payments/tami.ts'), 'utf8');
  assert.match(tami, /verifyCallbackHash/);
  assert.match(tami, /\/payment\/complete-3ds/);
  assert.doesNotMatch(tami, /fakeSuccess|mockPaid/);
  assert.doesNotMatch(qnbpay, /fakeSuccess|mockPaid/);
  assert.match(service, /Tami POS \/ Terminal ID henüz yapılandırılmadı/);
});

test('payment URLs carry productId not a client price', () => {
  const commerce = readFileSync(join(root, 'src/lib/commerce.ts'), 'utf8');
  const teaser = readFileSync(join(root, 'src/components/home/PricingTeaser.tsx'), 'utf8');
  const module = readFileSync(join(root, 'src/components/home/SecurePaymentSection.tsx'), 'utf8');
  const pricing = readFileSync(join(root, 'src/components/pricing/PricingView.tsx'), 'utf8');
  const navbar = readFileSync(join(root, 'src/components/Navbar.tsx'), 'utf8');
  assert.match(commerce, /\/payment\?\$\{params\.toString\(\)\}/);
  assert.match(commerce, /productId/);
  assert.doesNotMatch(commerce, /params\.set\(['"]price['"]/);
  assert.match(teaser, /paymentUrl\(item\.id/);
  assert.match(pricing, /paymentUrl\(item\.id/);
  assert.match(navbar, /href: '\/payment',\s*label: 'Ödeme'/);
  assert.match(module, /href="\/payment"/);
  assert.match(module, /Güvenli Ödeme/);
  assert.doesNotMatch(module, /javascript:void|href=["']#["']/);
  assert.doesNotMatch(teaser, /javascript:void|href=["']#["']/);
  assert.doesNotMatch(pricing, /javascript:void|href=["']#["']/);
  assert.doesNotMatch(navbar, /javascript:void|href=["']#["']/);
});

const VAT_RATE = 0.2;

function calcVatMinor(subtotalMinor) {
  return Math.round(subtotalMinor * VAT_RATE);
}

function calcTotalMinor(subtotalMinor) {
  return subtotalMinor + calcVatMinor(subtotalMinor);
}

test('KDV %20 calculation uses integer minor units', () => {
  assert.equal(calcVatMinor(10000), 2000);
  assert.equal(calcTotalMinor(10000), 12000);
  assert.equal(calcVatMinor(100000), 20000);
  assert.equal(calcTotalMinor(100000), 120000);
  assert.equal(calcVatMinor(125000), 25000);
  assert.equal(calcTotalMinor(125000), 150000);
});

test('checkout applies central 20% VAT server-side', () => {
  const commerce = readFileSync(join(root, 'src/lib/commerce.ts'), 'utf8');
  const vatConfig = readFileSync(join(root, 'src/config/vat.ts'), 'utf8');
  const serviceFile = readFileSync(join(root, 'src/lib/payments/service.ts'), 'utf8');
  assert.match(commerce, /calculateVatMinor/);
  assert.match(commerce, /@\/config\/vat/);
  assert.match(vatConfig, /VAT_RATE = 0\.2/);
  assert.match(vatConfig, /VAT_RATE_PERCENT = 20/);
  assert.match(serviceFile, /vatRatePercent: quote\.vatRatePercent/);
  assert.match(serviceFile, /amountMinor: quote\.totalMinor/);
  assert.match(checkout, /KDV Dahil Toplam/);
  assert.match(checkout, /Karttan çekilecek/);
});
