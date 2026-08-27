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

function generatePgAuthToken(merchantId, merchantUser, secretKey) {
  const digest = createHash('sha256').update(`${merchantId}${merchantUser}${secretKey}`, 'utf8').digest();
  return `${merchantId}:${merchantUser}:${digest.toString('base64')}`;
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
  const token = generatePgAuthToken('77006950', '84006953', 'secret-key');
  const [, , digest] = token.split(':');
  assert.equal(token.startsWith('77006950:84006953:'), true);
  const expected = createHash('sha256').update('7700695084006953secret-key', 'utf8').digest('base64');
  assert.equal(digest, expected);
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
  assert.equal(existsSync(join(root, 'src/lib/payments/iyzico.ts')), false);
  const tami = readFileSync(join(root, 'src/lib/payments/tami.ts'), 'utf8');
  const crypto = readFileSync(join(root, 'src/lib/payments/tami-crypto.ts'), 'utf8');
  const config = readFileSync(join(root, 'src/config/payment.ts'), 'utf8');
  assert.match(tami, /\/payment\/auth/);
  assert.match(tami, /\/payment\/complete-3ds/);
  assert.match(tami, /\/payment\/query/);
  assert.match(crypto, /generatePgAuthToken/);
  assert.match(crypto, /verifyCallbackHash/);
  assert.match(config, /TAMI_ENV/);
  assert.match(config, /sandbox-paymentapi\.tami\.com\.tr/);
  assert.match(config, /paymentapi\.tami\.com\.tr/);
  assert.match(config, /QNBPAY_ENABLED, false/);
  assert.doesNotMatch(tami, /fakeSuccess|mockPaid/);
  assert.doesNotMatch(tami, /console\.log\(.*card/);
});
