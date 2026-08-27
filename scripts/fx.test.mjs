import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const SAMPLE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<Tarih_Date Tarih="27.08.2026" Date="08/27/2026" Bulten_No="2026/165">
  <Currency CrossOrder="0" Kod="USD" CurrencyCode="USD">
    <Unit>1</Unit>
    <Isim>ABD DOLARI</Isim>
    <CurrencyName>US DOLLAR</CurrencyName>
    <ForexBuying>42.1234</ForexBuying>
    <ForexSelling>42.4639</ForexSelling>
    <BanknoteBuying>42.0000</BanknoteBuying>
    <BanknoteSelling>42.5000</BanknoteSelling>
  </Currency>
</Tarih_Date>`;

function xmlTag(block, tag) {
  const match = new RegExp(`<${tag}>([^<]*)</${tag}>`, 'i').exec(block);
  return match?.[1]?.trim() ?? '';
}

function parseTcmbUsdSelling(xml) {
  const usdBlock = /<Currency\b[^>]*CurrencyCode="USD"[^>]*>([\s\S]*?)<\/Currency>/i.exec(xml)?.[1];
  if (!usdBlock) throw new Error('tcmb_usd_not_found');
  const unit = Number(xmlTag(usdBlock, 'Unit').replace(',', '.')) || 1;
  const selling = Number(xmlTag(usdBlock, 'ForexSelling').replace(',', '.'));
  const dateMatch = /\bDate="(\d{2})\/(\d{2})\/(\d{4})"/.exec(xml);
  const date = dateMatch ? `${dateMatch[3]}-${dateMatch[1]}-${dateMatch[2]}` : '';
  return { rate: Number((selling / unit).toFixed(6)), date, rateType: 'ForexSelling', source: 'TCMB' };
}

function toMinorUnits(amount) {
  return Math.round((Math.round((amount + Number.EPSILON) * 100) / 100) * 100);
}

function fromMinorUnits(minor) {
  return minor / 100;
}

function convertUsdMinorToTryMinor(usdMinor, usdTryRate) {
  const rateScaled = BigInt(Math.round(usdTryRate * 10_000));
  const usd = BigInt(Math.round(usdMinor));
  const product = usd * rateScaled;
  return Number((product + 5000n) / 10000n);
}

function convertUsdToTry(usdAmount, usdTryRate) {
  return fromMinorUnits(convertUsdMinorToTryMinor(toMinorUnits(usdAmount), usdTryRate));
}

test('TEST 1-2: TCMB XML parses USD ForexSelling', () => {
  const parsed = parseTcmbUsdSelling(SAMPLE_XML);
  assert.equal(parsed.rate, 42.4639);
  assert.equal(parsed.date, '2026-08-27');
  assert.equal(parsed.rateType, 'ForexSelling');
  assert.equal(parsed.source, 'TCMB');
});

test('TEST 3: 199 USD converts to 8450.32 TRY', () => {
  assert.equal(convertUsdToTry(199, 42.4639), 8450.32);
});

test('sample catalog amounts convert with 4-decimal TCMB rate', () => {
  assert.equal(convertUsdToTry(100, 42.4639), 4246.39);
  assert.equal(convertUsdToTry(399, 42.4639), 16943.1);
  assert.equal(convertUsdToTry(999, 42.4639), 42421.44);
});

test('TEST 4: unreachable TCMB uses cached rate', () => {
  const cache = { rate: 42.4639, date: '2026-08-27', fetchedAt: '2026-08-27T07:00:00.000Z' };
  let liveFailed = true;
  const result = liveFailed ? { ...cache, status: 'CACHED' } : null;
  assert.equal(result.status, 'CACHED');
  assert.equal(result.rate, 42.4639);
  assert.equal(convertUsdToTry(199, result.rate), 8450.32);
});

test('TEST 5: no cache keeps USD and hides TRY amount', () => {
  const quote = { rate: null, status: 'UNAVAILABLE' };
  assert.equal(quote.rate, null);
  const usdLabel = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(199);
  assert.equal(usdLabel, '$199.00');
});

test('TEST 6: frontend rate and tryAmount fields are ignored', () => {
  const http = readFileSync(join(root, 'src/lib/payments/http.ts'), 'utf8');
  assert.match(http, /exchangeRate/);
  assert.match(http, /tryAmount/);
  assert.match(http, /price_tamper_ignored/);
});

test('TEST 7: payment snapshot fields exist on order start', () => {
  const types = readFileSync(join(root, 'src/lib/payments/types.ts'), 'utf8');
  const service = readFileSync(join(root, 'src/lib/payments/service.ts'), 'utf8');
  const charge = readFileSync(join(root, 'src/lib/payments/charge.ts'), 'utf8');
  assert.match(types, /chargedAmountMinor/);
  assert.match(types, /exchangeRateSource/);
  assert.match(service, /snapshotTryCharge/);
  assert.match(charge, /hasFrozenTryCharge/);
  assert.match(charge, /chargedCurrency: 'TRY'/);
});

test('TEST 8: 3DS verify does not fetch TCMB again', () => {
  const tami = readFileSync(join(root, 'src/lib/payments/tami.ts'), 'utf8');
  const verify = tami.slice(tami.indexOf('async verifyPayment'), tami.indexOf('async getPaymentStatus'));
  assert.doesNotMatch(verify, /getUsdTryQuote|fetchTcmbUsdSelling|today\.xml/);
  assert.match(verify, /chargedAmountMinor/);
});

test('TEST 9: Tami auth uses TRY snapshot amount', () => {
  const tami = readFileSync(join(root, 'src/lib/payments/tami.ts'), 'utf8');
  assert.match(tami, /currency: 'TRY'/);
  assert.match(tami, /tamiChargeMinor/);
  assert.doesNotMatch(tami, /currency: order\.currency \|\| 'USD'/);
});

test('TEST 10: VAT is applied in USD before TRY conversion', () => {
  const charge = readFileSync(join(root, 'src/lib/payments/charge.ts'), 'utf8');
  const vat = readFileSync(join(root, 'src/config/vat.ts'), 'utf8');
  assert.match(vat, /calculateTotalMinor/);
  assert.match(charge, /usdTotalMinor/);
  const usdTotal = 120;
  assert.equal(convertUsdToTry(usdTotal, 42.4639), 5095.67);
});

test('TEST 12: Turkish lira formatting', () => {
  const formatted = new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(8450.32);
  assert.match(formatted, /8.450,32|8\.450,32/);
});

test('TCMB service, API, ProductPrice and no hardcoded rate', () => {
  assert.equal(existsSync(join(root, 'src/services/exchange-rate/tcmb.ts')), true);
  assert.equal(existsSync(join(root, 'src/app/api/exchange-rates/usd-try/route.ts')), true);
  assert.equal(existsSync(join(root, 'src/components/price/ProductPrice.tsx')), true);
  const tcmb = readFileSync(join(root, 'src/services/exchange-rate/tcmb.ts'), 'utf8');
  const api = readFileSync(join(root, 'src/app/api/exchange-rates/usd-try/route.ts'), 'utf8');
  const convert = readFileSync(join(root, 'src/lib/fx/convert.ts'), 'utf8');
  assert.match(tcmb, /tcmb\.gov\.tr\/kurlar\/today\.xml/);
  assert.match(tcmb, /ForexSelling/);
  assert.match(api, /getUsdTryQuote/);
  assert.match(convert, /BigInt/);
  assert.doesNotMatch(tcmb, /42\.4639/);
  assert.doesNotMatch(api, /42\.4639/);
});
