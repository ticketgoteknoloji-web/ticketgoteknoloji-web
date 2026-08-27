import assert from 'node:assert/strict';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function base64UrlEncode(input) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input, 'utf8');
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function generatePgAuthToken(merchantNumber, terminalNumber, secretKey) {
  const text = String(merchantNumber) + String(terminalNumber) + String(secretKey);
  const hash = createHash('sha256').update(text, 'utf8').digest('base64');
  return `${merchantNumber}:${terminalNumber}:${hash}`;
}

function generateTamiPointQueryHash(merchantNumber, terminalNumber, secretKey) {
  const text = String(merchantNumber) + String(terminalNumber) + String(secretKey);
  return createHash('sha256').update(text, 'utf8').digest('base64');
}

function computeCallbackHash(callback, secretKey) {
  const params =
    callback.hashParams ||
    'cardOrganization+cardBrand+cardType+maskedNumber+installmentCount+currencyCode+txnAmount+orderId+systemTime+success';
  let data = '';
  for (const field of params.split('+')) {
    const name = field.trim();
    if (!name) continue;
    let value = callback[name] ?? '';
    if (name === 'success') {
      if (value === true || value === 1 || value === '1' || value === 'true') value = 'true';
      else if (value === false || value === 0 || value === '0' || value === 'false') value = 'false';
    }
    data += String(value);
  }
  return createHmac('sha256', secretKey).update(data, 'utf8').digest('base64');
}

test('Tami crypto matches documented PG-Auth-Token format', () => {
  const merchantNumber = '123456';
  const terminalNumber = '789012';
  const secretKey = 'TEST_SECRET';
  const token = generatePgAuthToken(merchantNumber, terminalNumber, secretKey);
  const expectedHash = createHash('sha256')
    .update(merchantNumber + terminalNumber + secretKey, 'utf8')
    .digest('base64');
  const colonHash = createHash('sha256')
    .update(`${merchantNumber}:${terminalNumber}:${secretKey}`, 'utf8')
    .digest('base64');
  const hexHash = createHash('sha256').update(merchantNumber + terminalNumber + secretKey, 'utf8').digest('hex');
  const parts = token.split(':');

  assert.equal(token, `${merchantNumber}:${terminalNumber}:${expectedHash}`);
  assert.equal(parts.length, 3);
  assert.equal(token.split(':').length - 1, 2);
  assert.equal(parts[0], merchantNumber);
  assert.equal(parts[1], terminalNumber);
  assert.equal(parts[2], expectedHash);
  assert.doesNotMatch(token, /\s/);
  assert.match(expectedHash, /^[A-Za-z0-9+/]+={0,2}$/);
  assert.notEqual(parts[2], hexHash);
  assert.notEqual(parts[2], colonHash);
  assert.equal(token.includes(secretKey), false);
  assert.equal(createHash('sha256').update(merchantNumber + terminalNumber + secretKey, 'utf8').digest('base64'), expectedHash);
});

test('Tami point-query hash matches SHA-256 Base64 without separators', () => {
  const merchantNumber = '123456';
  const terminalNumber = '789012';
  const secretKey = 'TEST_SECRET';
  const input = '123456789012TEST_SECRET';
  const hash = generateTamiPointQueryHash(merchantNumber, terminalNumber, secretKey);
  const expected = createHash('sha256').update(input, 'utf8').digest('base64');
  const colonHash = createHash('sha256').update(`${merchantNumber}:${terminalNumber}:${secretKey}`, 'utf8').digest('base64');
  const hexHash = createHash('sha256').update(input, 'utf8').digest('hex');

  assert.equal(merchantNumber + terminalNumber + secretKey, input);
  assert.equal(hash, expected);
  assert.match(hash, /^[A-Za-z0-9+/]+={0,2}$/);
  assert.notEqual(hash, hexHash);
  assert.notEqual(hash, colonHash);
  assert.doesNotMatch(hash, /:/);
  assert.equal(hash.includes(secretKey), false);
  assert.doesNotMatch(hash, /\s/);
});

test('Tami callback hash canonicalises success 1/0 to true/false', () => {
  const payload = {
    hashParams: 'orderId+success+txnAmount',
    orderId: 'SIP-1',
    success: '1',
    txnAmount: '10.00',
    hashedData: '',
  };
  const secret = 'store-key';
  payload.hashedData = computeCallbackHash(payload, secret);
  const expected = createHmac('sha256', secret).update('SIP-1true10.00', 'utf8').digest('base64');
  assert.equal(payload.hashedData, expected);
  const a = Buffer.from(payload.hashedData);
  const b = Buffer.from(expected);
  assert.equal(a.length === b.length && timingSafeEqual(a, b), true);
});

test('Tami JWT header is HS512 compact without padding', () => {
  const header = base64UrlEncode(JSON.stringify({ alg: 'HS512', typ: 'JWT', kid: 'kid-1' }));
  assert.doesNotMatch(header, /=/);
  assert.doesNotMatch(header, /\+/);
  assert.doesNotMatch(header, /\//);
});

test('Tami routes and provider exist; iyzico stays removed', () => {
  assert.equal(existsSync(join(root, 'src/lib/payments/tami.ts')), true);
  assert.equal(existsSync(join(root, 'src/app/api/payments/tami/create/route.ts')), true);
  assert.equal(existsSync(join(root, 'src/app/api/payments/tami/callback/route.ts')), true);
  assert.equal(existsSync(join(root, 'src/app/api/payments/tami/launch/route.ts')), true);
  assert.equal(existsSync(join(root, 'src/lib/payments/tami-points.ts')), true);
  assert.equal(existsSync(join(root, 'src/app/api/payments/tami/points/route.ts')), true);
  assert.equal(existsSync(join(root, 'src/lib/payments/iyzico.ts')), false);
  const tami = readFileSync(join(root, 'src/lib/payments/tami.ts'), 'utf8');
  const crypto = readFileSync(join(root, 'src/lib/payments/tami-crypto.ts'), 'utf8');
  const points = readFileSync(join(root, 'src/lib/payments/tami-points.ts'), 'utf8');
  const pointsRoute = readFileSync(join(root, 'src/app/api/payments/tami/points/route.ts'), 'utf8');
  const checkout = readFileSync(join(root, 'src/components/payment/PaymentCheckout.tsx'), 'utf8');
  const config = readFileSync(join(root, 'src/config/payment.ts'), 'utf8');
  assert.match(tami, /\/payment\/auth/);
  assert.match(tami, /\/payment\/complete-3ds/);
  assert.match(tami, /\/payment\/query/);
  assert.doesNotMatch(tami, /generateTamiPointQueryHash/);
  assert.match(crypto, /generatePgAuthToken/);
  assert.match(crypto, /generateTamiPointQueryHash/);
  assert.match(crypto, /createHash\('sha256'\)/);
  assert.match(crypto, /\.update\(text, 'utf8'\)/);
  assert.match(crypto, /\.digest\('base64'\)/);
  assert.match(crypto, /String\(merchantNumber\) \+ String\(terminalNumber\) \+ String\(secretKey\)/);
  assert.doesNotMatch(crypto, /String\(merchantNumber\) \+ ':' \+ String\(terminalNumber\) \+ ':' \+ String\(secretKey\)/);
  assert.match(crypto, /\$\{merchantNumber\}:\$\{terminalNumber\}:\$\{hash\}/);
  assert.match(crypto, /verifyCallbackHash/);
  assert.match(points, /generateTamiPointQueryHash\(cfg\.merchantId, cfg\.posId, cfg\.secretKey\)/);
  assert.match(points, /TAMI_POINT_QUERY_ENDPOINT: string \| null = null/);
  assert.doesNotMatch(points, /\/loyalty|\/bonus|\/point-query/);
  assert.match(pointsRoute, /originAllowed/);
  assert.match(pointsRoute, /rateLimit\(`tami-points:\$\{ip\}`/);
  assert.doesNotMatch(pointsRoute, /secretKey|pointHash|PG-Auth-Token/);
  assert.match(checkout, /Kullanılabilir Puan/);
  assert.match(checkout, /tamiPointPanel\.available/);
  assert.match(tami, /'PG-Api-Version': 'v3'/);
  assert.match(tami, /'PG-Auth-Token': generatePgAuthToken\(cfg\.merchantId, cfg\.posId, cfg\.secretKey\)/);
  assert.match(tami, /correlationId: `Correlation\$\{randomBytes\(16\)\.toString\('hex'\)\}`/);
  assert.doesNotMatch(tami, /console\.(log|info|debug).*PG-Auth-Token/);
  assert.doesNotMatch(crypto, /console\.(log|info|debug)/);
  assert.match(config, /TAMI_ENV/);
  assert.match(config, /sandbox-paymentapi\.tami\.com\.tr/);
  assert.match(config, /paymentapi\.tami\.com\.tr/);
  assert.match(config, /QNBPAY_ENABLED, false/);
  assert.doesNotMatch(tami, /fakeSuccess|mockPaid/);
  assert.doesNotMatch(tami, /console\.log\(.*card/);
});
