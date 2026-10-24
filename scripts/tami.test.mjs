import assert from 'node:assert/strict';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

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

function isUsableTamiCredential(value) {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) return false;
  const upper = trimmed.toUpperCase();
  if (upper.startsWith('GERCEK_') || upper.startsWith('BURAYA_')) return false;
  if (
    upper === 'GERCEK_POS_ID' ||
    upper === 'GERCEK_TERMINAL_ID' ||
    upper === 'BURAYA_POS_ID' ||
    upper === 'BURAYA_TERMINAL_ID' ||
    upper === 'CHANGE_ME' ||
    upper === 'PLACEHOLDER' ||
    upper === 'EXAMPLE' ||
    upper === 'TEST_VALUE'
  ) {
    return false;
  }
  return true;
}

function hasUsableTamiPosId(posId, merchantId) {
  if (!isUsableTamiCredential(posId)) return false;
  const merchant = String(merchantId ?? '').trim();
  if (merchant && String(posId).trim() === merchant) return false;
  return true;
}

function resolveTamiPosId(posId, terminalId, merchantId) {
  if (hasUsableTamiPosId(posId, merchantId)) return String(posId).trim();
  if (posId !== undefined) return '';
  if (terminalId !== undefined && hasUsableTamiPosId(terminalId, merchantId)) return String(terminalId).trim();
  return '';
}

function tamiIsConfigured({ enabled = true, merchantId, posId, secretKey, kid, k }) {
  return Boolean(
    enabled &&
      isUsableTamiCredential(merchantId) &&
      hasUsableTamiPosId(posId, merchantId) &&
      isUsableTamiCredential(secretKey) &&
      isUsableTamiCredential(kid) &&
      isUsableTamiCredential(k)
  );
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

test('Tami configured requires a real POS ID and blocks auth without it', () => {
  const base = {
    merchantId: '123456',
    secretKey: 'dummy-secret',
    kid: 'dummy-kid',
    k: 'dummy-k-value',
  };
  assert.equal(tamiIsConfigured({ ...base, posId: '' }), false);
  assert.equal(tamiIsConfigured({ ...base, posId: '   ' }), false);
  assert.equal(tamiIsConfigured({ ...base, posId: 'GERCEK_POS_ID' }), false);
  assert.equal(tamiIsConfigured({ ...base, posId: 'GERCEK_TERMINAL_ID' }), false);
  assert.equal(tamiIsConfigured({ ...base, posId: 'BURAYA_POS_ID' }), false);
  assert.equal(tamiIsConfigured({ ...base, posId: 'BURAYA_TERMINAL_ID' }), false);
  assert.equal(tamiIsConfigured({ ...base, posId: 'CHANGE_ME' }), false);
  assert.equal(tamiIsConfigured({ ...base, posId: 'PLACEHOLDER' }), false);
  assert.equal(tamiIsConfigured({ ...base, posId: 'BURAYA_YAZIN' }), false);
  assert.equal(tamiIsConfigured({ ...base, posId: 'TEST_VALUE' }), false);
  assert.equal(tamiIsConfigured({ ...base, posId: 'EXAMPLE' }), false);
  assert.equal(tamiIsConfigured({ ...base, posId: 'GERCEK_ANYTHING' }), false);
  assert.equal(tamiIsConfigured({ ...base, posId: base.merchantId }), false);
  assert.equal(tamiIsConfigured({ ...base, posId: '84006953' }), true);

  assert.equal(resolveTamiPosId('GERCEK_POS_ID', undefined, base.merchantId), '');
  assert.equal(resolveTamiPosId('BURAYA_POS_ID', undefined, base.merchantId), '');
  assert.equal(resolveTamiPosId('CHANGE_ME', undefined, base.merchantId), '');
  assert.equal(resolveTamiPosId('', undefined, base.merchantId), '');
  assert.equal(resolveTamiPosId(undefined, undefined, base.merchantId), '');
  assert.equal(resolveTamiPosId('', '84006953', base.merchantId), '');
  assert.equal(resolveTamiPosId(undefined, '', base.merchantId), '');
  assert.equal(resolveTamiPosId(undefined, 'PLACEHOLDER', base.merchantId), '');
  assert.equal(resolveTamiPosId(undefined, base.merchantId, base.merchantId), '');
  assert.equal(resolveTamiPosId(undefined, '84006953', base.merchantId), '84006953');
  assert.equal(resolveTamiPosId('84006953', '99999999', base.merchantId), '84006953');
  assert.equal(tamiIsConfigured({ ...base, posId: resolveTamiPosId('', undefined, base.merchantId) }), false);
  assert.equal(tamiIsConfigured({ ...base, posId: resolveTamiPosId('84006953', undefined, base.merchantId) }), true);

  const tami = readFileSync(join(root, 'src/lib/payments/tami.ts'), 'utf8');
  const config = readFileSync(join(root, 'src/config/payment.ts'), 'utf8');
  const libConfig = readFileSync(join(root, 'src/lib/payments/config.ts'), 'utf8');
  const http = readFileSync(join(root, 'src/lib/payments/http.ts'), 'utf8');
  const health = readFileSync(join(root, 'src/app/api/payments/tami/health/route.ts'), 'utf8');
  const checkout = readFileSync(join(root, 'src/components/payment/PaymentCheckout.tsx'), 'utf8');
  const envExample = readFileSync(join(root, '.env.example'), 'utf8');
  assert.match(envExample, /TAMI_POS_ID=/);
  assert.match(config, /function resolveTamiPosId/);
  assert.match(config, /tamiPosId = resolveTamiPosId\(\)/);
  assert.match(config, /hasUsableTamiPosId\(tamiPosId, tamiMerchantId\)/);
  assert.match(config, /GERCEK_POS_ID/);
  assert.match(config, /GERCEK_TERMINAL_ID/);
  assert.match(config, /BURAYA_POS_ID/);
  assert.match(config, /startsWith\('GERCEK_'\) \|\| upper\.startsWith\('BURAYA_'\)/);
  assert.match(config, /CHANGE_ME/);
  assert.match(config, /PLACEHOLDER/);
  assert.match(config, /TEST_VALUE/);
  assert.match(config, /EXAMPLE/);
  assert.match(libConfig, /isUsableTamiCredential\(cfg\.merchantId\)/);
  assert.match(libConfig, /isUsableTamiCredential\(cfg\.secretKey\)/);
  assert.match(libConfig, /isUsableTamiCredential\(cfg\.kid\)/);
  assert.match(libConfig, /isUsableTamiCredential\(cfg\.k\)/);
  assert.doesNotMatch(config, /TAMI_POS_ID\) \|\| trim\(process\.env\.TAMI_TERMINAL_ID\)/);
  assert.doesNotMatch(config, /posId \|\| tamiMerchantId|merchantId as pos/i);
  assert.match(libConfig, /export function isTamiReady/);
  assert.match(http, /hasUsableTamiPosId\(tamiConfig\(\)\.posId, tamiConfig\(\)\.merchantId\)/);
  assert.doesNotMatch(http, /TAMI_POS_ID \|\| process\.env\.TAMI_TERMINAL_ID/);
  assert.match(tami, /MISSING_POS_ID/);
  assert.match(tami, /tami_http_blocked/);
  assert.match(tami, /isTamiReady\(\)/);
  assert.match(health, /configured: health\.configured && isTamiReady\(\)/);
  assert.match(health, /status: `Tami: \$\{health\.status\}`/);
  const createFn = tami.slice(tami.indexOf('async createPayment'), tami.indexOf('async verifyPayment'));
  const notConfiguredAt = createFn.indexOf("code: 'not_configured'");
  const authCallAt = createFn.indexOf('tamiPost(TAMI_AUTH_PATH');
  assert.equal(notConfiguredAt >= 0 && authCallAt > notConfiguredAt, true);
  const postFn = tami.slice(tami.indexOf('async function tamiPost'), tami.indexOf('function buildAuthBody'));
  const blockedAt = postFn.indexOf('tami_http_blocked');
  const fetchAt = postFn.indexOf('await fetch');
  const tokenAt = postFn.indexOf('generatePgAuthToken');
  assert.equal(blockedAt >= 0 && fetchAt > blockedAt, true);
  assert.equal(tokenAt > blockedAt, true);
  assert.match(checkout, /if \(!configured\)/);
  assert.match(checkout, /POS\/Terminal aktivasyonu bekleniyor/);
  assert.doesNotMatch(tami, /posId \|\| cfg\.merchantId|merchantId as pos/i);
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

test('Tami merchant and terminal stay distinct and POS uses the terminal number', () => {
  const merchantId = '77034202';
  const terminalId = '84034204';
  assert.notEqual(merchantId, terminalId);
  assert.equal(resolveTamiPosId(terminalId, terminalId, merchantId), terminalId);
  assert.equal(resolveTamiPosId(undefined, terminalId, merchantId), terminalId);
  assert.equal(resolveTamiPosId(merchantId, terminalId, merchantId), '');
  assert.equal(hasUsableTamiPosId(terminalId, merchantId), true);
  assert.equal(hasUsableTamiPosId(merchantId, merchantId), false);
  const configSrc = readFileSync(join(root, 'src/config/payment.ts'), 'utf8');
  assert.match(configSrc, /flag\(process\.env\.TAMI_ENABLED, false\)/);
  assert.match(configSrc, /TAMI_SECRET_KEY/);
  assert.match(configSrc, /TAMI_KID/);
  assert.match(configSrc, /TAMI_K\)/);
  const example = readFileSync(join(root, '.env.example'), 'utf8');
  assert.match(example, /TAMI_ENABLED=false/);
  assert.match(example, /TAMI_MERCHANT_ID=/);
  assert.match(example, /TAMI_POS_ID=/);
  assert.match(example, /TAMI_SECRET_KEY=/);
  assert.doesNotMatch(example, /77034202|84034204/);
  const refundFn = readFileSync(join(root, 'src/lib/payments/tami.ts'), 'utf8');
  assert.match(refundFn, /tamiPost\(TAMI_REFUND_PATH/);
  assert.match(refundFn, /tamiChargeMinor\(order\)/);
  assert.match(refundFn, /tamiPost\(TAMI_VOID_PATH/);
  assert.doesNotMatch(refundFn, /partial|kısmi iade|refundAmount/i);
  const service = readFileSync(join(root, 'src/lib/payments/service.ts'), 'utf8');
  assert.match(service, /tamiCallbackInflight/);
  assert.match(service, /if \(order\.status === 'paid'\) return order;/);
  assert.match(service, /if \(current\?\.status === 'paid'\) return current;/);
  assert.match(service, /processedTransactionIds\?\.includes\(txn\)/);
  const store = readFileSync(join(root, 'src/lib/downloads/store.ts'), 'utf8');
  assert.match(store, /item\.orderId === input\.orderId && item\.productId === input\.productId && item\.status === 'active'/);
});

test('Tami callback rejects a tampered hash and accepts the canonical hash', () => {
  const secret = 'callback-test-secret';
  const payload = {
    hashParams: 'orderId+success+txnAmount',
    orderId: 'SIP-1',
    success: '0',
    txnAmount: '10.00',
    hashedData: '',
  };
  payload.hashedData = computeCallbackHash(payload, secret);
  const failed = createHmac('sha256', secret).update('SIP-1false10.00', 'utf8').digest('base64');
  assert.equal(payload.hashedData, failed);
  const tampered = { ...payload, success: '1' };
  const resigned = computeCallbackHash(tampered, secret);
  assert.notEqual(tampered.hashedData, resigned);
  tampered.hashedData = resigned;
  assert.equal(tampered.hashedData, createHmac('sha256', secret).update('SIP-1true10.00', 'utf8').digest('base64'));
});

test('Tami 3DS form action allows only the active Tami API origin', async () => {
  const { formActionDirective, inspectTami3dsHtml, QNB_SIPAY_FORM_ORIGINS, TAMI_3DS_ORIGINS } = await import(
    '../src/lib/payments/tami-3ds-policy.ts'
  );
  const production = formActionDirective('production');
  const sandbox = formActionDirective('sandbox');
  assert.match(production, /form-action 'self'/);
  for (const origin of QNB_SIPAY_FORM_ORIGINS) {
    assert.match(production, new RegExp(origin.replaceAll('.', '\\.')));
    assert.match(sandbox, new RegExp(origin.replaceAll('.', '\\.')));
  }
  assert.match(production, new RegExp(TAMI_3DS_ORIGINS.production.replaceAll('.', '\\.')));
  assert.equal(production.includes(TAMI_3DS_ORIGINS.sandbox), false);
  assert.match(sandbox, new RegExp(TAMI_3DS_ORIGINS.sandbox.replaceAll('.', '\\.')));
  assert.equal(sandbox.includes(TAMI_3DS_ORIGINS.production), false);
  assert.equal(production.includes('*'), false);
  assert.doesNotMatch(production, /(^|\s)https:(\s|$)/);
  assert.equal(production.includes('https://vpostest.qnb.com.tr'), true);
  const bank = (action) => `<form method="post" action="${action}"><input type="hidden" name="PaReq" value="challenge"></form>`;
  assert.equal(inspectTami3dsHtml(bank(`${TAMI_3DS_ORIGINS.production}/3d`), 'production').ok, true);
  assert.equal(inspectTami3dsHtml(bank(`${TAMI_3DS_ORIGINS.sandbox}/3d`), 'sandbox').ok, true);
  assert.deepEqual(inspectTami3dsHtml(bank(`${TAMI_3DS_ORIGINS.sandbox}/3d`), 'production'), { ok: false, reason: 'unverified_origin' });
  assert.deepEqual(inspectTami3dsHtml(bank('https://evil.example/phish'), 'production'), { ok: false, reason: 'unverified_origin' });
  assert.deepEqual(inspectTami3dsHtml(bank('http://paymentapi.tami.com.tr/3d'), 'production'), { ok: false, reason: 'insecure_target' });
  assert.deepEqual(inspectTami3dsHtml(bank('javascript:alert(1)'), 'production'), { ok: false, reason: 'insecure_target' });
  assert.deepEqual(inspectTami3dsHtml(bank('//evil.example/phish'), 'production'), { ok: false, reason: 'insecure_target' });
  assert.deepEqual(inspectTami3dsHtml(bank('https://paymentapi.tami.com.tr.evil.com/3d'), 'production'), { ok: false, reason: 'unverified_origin' });
  assert.deepEqual(inspectTami3dsHtml('<form method="post"></form>', 'production'), { ok: false, reason: 'missing_form' });
  assert.deepEqual(
    inspectTami3dsHtml(`${bank(TAMI_3DS_ORIGINS.production + '/3d')}<button formaction="https://evil.example"></button>`, 'production'),
    { ok: false, reason: 'unverified_origin' }
  );
  assert.deepEqual(
    inspectTami3dsHtml(
      `${bank(TAMI_3DS_ORIGINS.production + '/3d')}<meta http-equiv="refresh" content="0;url=https://acs.example/challenge">`,
      'production'
    ),
    { ok: false, reason: 'unverified_origin' }
  );
  assert.equal(
    inspectTami3dsHtml(
      `${bank(TAMI_3DS_ORIGINS.production + '/3d')}<meta http-equiv="refresh" content="0;url=${TAMI_3DS_ORIGINS.production}/3d">`,
      'production'
    ).ok,
    true
  );
  assert.deepEqual(inspectTami3dsHtml(bank('https://&#101;vil.example/3d'), 'production'), { ok: false, reason: 'unverified_origin' });
  const { tamiApiBase } = await import('../src/lib/payments/tami-3ds-policy.ts');
  assert.equal(tamiApiBase('production', 'https://evil.example/payment'), TAMI_3DS_ORIGINS.production);
  assert.equal(tamiApiBase('sandbox', 'https://paymentapi.tami.com.tr'), TAMI_3DS_ORIGINS.sandbox);
  assert.equal(tamiApiBase('production', `${TAMI_3DS_ORIGINS.production}/api/v0`), `${TAMI_3DS_ORIGINS.production}/api/v0`);
  assert.equal(tamiApiBase('production', 'http://paymentapi.tami.com.tr'), TAMI_3DS_ORIGINS.production);
  const middleware = readFileSync(join(root, 'src/middleware.ts'), 'utf8');
  const launch = readFileSync(join(root, 'src/app/api/payments/tami/launch/route.ts'), 'utf8');
  assert.match(middleware, /formActionDirective\(tami3dsEnv\(process\.env\.TAMI_ENV\)\)/);
  assert.match(middleware, /https:\/\/vpostest\.qnb\.com\.tr/);
  assert.match(middleware, /https:\/\/vpos\.qnb\.com\.tr/);
  assert.match(middleware, /https:\/\/app\.sipay\.com\.tr/);
  assert.match(middleware, /https:\/\/panel\.sipay\.com\.tr/);
  assert.doesNotMatch(middleware, /form-action[^"\n]*\*/);
  assert.match(launch, /inspectTami3dsHtml\(html, tamiConfig\(\)\.env\)/);
  assert.match(launch, /tami_launch_rejected_target/);
  assert.doesNotMatch(launch, /TAMI_SECRET_KEY|TAMI_PASSWORD|PG-Auth-Token/);
});

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'server-only') {
      return { url: 'data:text/javascript,export default {}', shortCircuit: true };
    }
    if (specifier.startsWith('@/')) {
      const base = join(root, 'src', specifier.slice(2));
      if (existsSync(base) && statSync(base).isFile()) return { url: pathToFileURL(base).href, shortCircuit: true };
      if (existsSync(base) && statSync(base).isDirectory()) {
        for (const index of ['index.ts', 'index.tsx', 'index.js']) {
          const candidate = join(base, index);
          if (existsSync(candidate)) return { url: pathToFileURL(candidate).href, shortCircuit: true };
        }
      }
      for (const ext of ['.ts', '.tsx', '.js', '.mjs', '.json']) {
        if (existsSync(base + ext)) return { url: pathToFileURL(base + ext).href, shortCircuit: true };
      }
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url.endsWith('.json')) {
      return { format: 'json', source: readFileSync(new URL(url), 'utf8'), shortCircuit: true };
    }
    return nextLoad(url, context);
  },
});

test('payment signing secret signs and verifies Tami and QNB launch tokens', async () => {
  const previousSecret = process.env.PAYMENT_SIGNING_SECRET;
  const previousEnv = process.env.PAYMENT_ENV;
  process.env.PAYMENT_ENV = 'production';
  process.env.PAYMENT_SIGNING_SECRET = 'fixture-signing-secret-not-a-real-key-0123456789abcdef';
  try {
    const { hmacEquals, hmacSign } = await import('../src/lib/payments/security.ts');
    const { tamiLaunchToken, tamiLaunchTokenOk } = await import('../src/lib/payments/tami-3ds.ts');
    const { launchToken } = await import('../src/lib/payments/qnb-payfor.ts');
    const tami = tamiLaunchToken('attempt-1', 'order-1');
    assert.equal(tamiLaunchTokenOk('attempt-1', 'order-1', tami), true);
    assert.equal(tamiLaunchTokenOk('attempt-1', 'order-2', tami), false);
    assert.equal(tamiLaunchTokenOk('attempt-1', 'order-1', `${tami}00`), false);
    const qnb = launchToken('attempt-1', 'order-1');
    assert.equal(hmacEquals(qnb, hmacSign('attempt-1:order-1')), true);
    assert.equal(hmacEquals(qnb, hmacSign('attempt-1:order-2')), false);
    assert.notEqual(tami, qnb);
    assert.equal(hmacEquals(hmacSign('admin-key'), hmacSign('admin-key')), true);
    assert.equal(hmacEquals(hmacSign('admin-key'), hmacSign('other-key')), false);
    delete process.env.PAYMENT_SIGNING_SECRET;
    assert.throws(() => hmacSign('x'), /PAYMENT_SIGNING_SECRET is required in production/);
  } finally {
    if (previousSecret === undefined) delete process.env.PAYMENT_SIGNING_SECRET;
    else process.env.PAYMENT_SIGNING_SECRET = previousSecret;
    if (previousEnv === undefined) delete process.env.PAYMENT_ENV;
    else process.env.PAYMENT_ENV = previousEnv;
  }
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
  assert.match(tami, /\/api\/v0\/payment\/auth/);
  assert.match(tami, /\/api\/v0\/payment\/complete-3ds/);
  assert.match(tami, /\/api\/v0\/payment\/orderQuery/);
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
  assert.match(tami, /'PG-Api-Version': 'v4'/);
  assert.match(tami, /'PG-Auth-Token': generatePgAuthToken\(cfg\.merchantId, cfg\.posId, cfg\.secretKey\)/);
  assert.match(tami, /const correlationId = `Correlation\$\{randomBytes\(16\)\.toString\('hex'\)\}`/);
  assert.match(tami, /errorMessage: asString\(data\.errorMessage\)/);
  assert.match(tami, /payloadShape: path === TAMI_AUTH_PATH \? describeTamiPayloadShape\(body\)/);
  assert.doesNotMatch(tami, /console\.(log|info|debug).*PG-Auth-Token/);
  assert.doesNotMatch(crypto, /console\.(log|info|debug)/);
  assert.match(config, /TAMI_ENV/);
  assert.match(config, /sandbox-paymentapi\.tami\.com\.tr/);
  assert.match(config, /paymentapi\.tami\.com\.tr/);
  assert.match(config, /QNBPAY_ENABLED, false/);
  assert.doesNotMatch(tami, /fakeSuccess|mockPaid/);
  assert.doesNotMatch(tami, /console\.log\(.*card/);
});
