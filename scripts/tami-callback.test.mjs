import './register-src-hooks.mjs';

import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createDecipheriv, createHash } from 'node:crypto';
import { appendFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const SECRET = 'fixture-callback-secret';
const K_VALUE = Buffer.from('fixture-tami-callback-key-32b!!').toString('base64url');
const HASH_PARAMS =
  'cardOrganization+cardBrand+cardType+maskedNumber+installmentCount+currencyCode+txnAmount+orderId+systemTime+success';
const ENV_KEYS = [
  'TAMI_ENABLED',
  'TAMI_ENV',
  'TAMI_MERCHANT_ID',
  'TAMI_POS_ID',
  'TAMI_TERMINAL_ID',
  'TAMI_SECRET_KEY',
  'TAMI_USERNAME',
  'TAMI_PASSWORD',
  'TAMI_KID',
  'TAMI_K',
  'PAYMENT_ORDERS_FILE',
  'DOWNLOAD_DATA_FILE',
];

const savedEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
const originalFetch = globalThis.fetch;
const dir = mkdtempSync(join(tmpdir(), 'tg-tami-callback-'));
const ordersFile = join(dir, 'payments.json');
const downloadsFile = join(dir, 'downloads.json');

function restoreEnv() {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
  globalThis.fetch = originalFetch;
}

function useFixtureEnv() {
  process.env.TAMI_ENABLED = 'true';
  process.env.TAMI_ENV = 'sandbox';
  process.env.TAMI_MERCHANT_ID = '10000001';
  process.env.TAMI_POS_ID = '20000002';
  process.env.TAMI_TERMINAL_ID = '20000002';
  process.env.TAMI_SECRET_KEY = SECRET;
  process.env.TAMI_USERNAME = 'fixture-kid';
  process.env.TAMI_PASSWORD = K_VALUE;
  delete process.env.TAMI_KID;
  delete process.env.TAMI_K;
  process.env.PAYMENT_ORDERS_FILE = ordersFile;
  process.env.DOWNLOAD_DATA_FILE = downloadsFile;
}

function writeDownloads() {
  writeFileSync(
    downloadsFile,
    JSON.stringify({
      packages: [
        {
          id: 'pkg-callback',
          productId: 'prod-callback',
          name: 'Callback Fixture',
          description: 'fixture',
          platforms: ['windows'],
          platform: 'Windows',
          version: '1',
          architecture: 'x64',
          fileType: 'zip',
          mimeType: 'application/zip',
          fileSize: '1 B',
          fileSizeBytes: 1,
          priceUsd: 10,
          currency: 'USD',
          storedFileName: 'fixture.bin',
          originalFileName: 'fixture.bin',
          storageRelativePath: 'fixture.bin',
          checksumSha256: 'abc',
          uploadedAt: '2026-10-24T09:00:00.000Z',
          uploadedBy: 'test',
          published: true,
          status: 'published',
          saleOpen: true,
        },
      ],
      entitlements: [],
      audit: [],
    })
  );
}

function entitlementCount() {
  const db = JSON.parse(readFileSync(downloadsFile, 'utf8'));
  return db.entitlements.filter((item) => item.status === 'active').length;
}

function readPayments() {
  return JSON.parse(readFileSync(ordersFile, 'utf8'));
}

function attemptRecord(orderId) {
  const now = '2026-10-24T09:00:00.000Z';
  return {
    id: `attempt-${orderId}`,
    orderId,
    provider: 'tami',
    status: 'redirected',
    amountMinor: 19900,
    currency: 'TRY',
    installment: 1,
    cardProgram: null,
    providerReference: null,
    providerTransactionId: null,
    responseCode: null,
    mdStatus: null,
    bankReference: null,
    createdAt: now,
    updatedAt: now,
  };
}

function orderRecord(id, orderNumber) {
  const now = '2026-10-24T09:00:00.000Z';
  return {
    id,
    orderNumber,
    productId: 'prod-callback',
    productName: 'Callback Fixture',
    description: 'fixture',
    quantity: 1,
    period: 'once',
    currency: 'USD',
    unitAmountMinor: 1000,
    subtotalMinor: 1000,
    vatMinor: 200,
    vatRatePercent: 20,
    amountMinor: 1200,
    status: 'awaiting_payment',
    paymentProvider: 'tami',
    providerPaymentId: orderNumber,
    providerConversationId: orderNumber,
    providerToken: id,
    paymentTransactionId: null,
    customerName: 'Test User',
    customerEmail: 'callback-test@example.com',
    customerPhone: '+905551112233',
    customer: {
      firstName: 'Test',
      lastName: 'User',
      email: 'callback-test@example.com',
      phone: '+905551112233',
      identityNumber: '10000000146',
      address: 'Adres',
      city: 'Istanbul',
      country: 'TR',
      billingType: 'individual',
    },
    idempotencyKey: `idem-${id}-0123456789`,
    statusToken: `status-${id}`,
    paidAt: null,
    distanceSalesVersion: '1',
    preInformationVersion: '1',
    legalAcceptedAt: now,
    originalAmountMinor: 1200,
    originalCurrency: 'USD',
    exchangeRate: 16.5833,
    exchangeRateSource: 'TCMB',
    exchangeRateDate: '2026-10-24',
    chargedAmountMinor: 19900,
    chargedCurrency: 'TRY',
    createdAt: now,
    updatedAt: now,
  };
}

function bankSuccess(orderId) {
  return {
    success: true,
    orderId,
    amount: 199,
    currency: 'TRY',
    bankReferenceNumber: `REF-${orderId}`,
  };
}

const isCallbackChild = process.env.TAMI_CALLBACK_CHILD === '1';

async function runCallbackChild() {
  const { signTamiResponse } = await import('../src/lib/payments/tami-crypto.ts');
  const { finalizeFromCallback } = await import('../src/lib/payments/service.ts');
  globalThis.fetch = async (url) => {
    const href = String(url);
    appendFileSync(process.env.TAMI_CALL_LOG, `${href}\n`);
    if (!href.endsWith('/api/v0/payment/complete-3ds')) throw new Error('child_unexpected_bank_call');
    await new Promise((resolve) => setTimeout(resolve, 180));
    const signedResponse = signTamiResponse({
      kid: 'fixture-kid',
      k: process.env.TAMI_PASSWORD,
      merchantNumber: process.env.TAMI_MERCHANT_ID,
      terminalNumber: process.env.TAMI_POS_ID,
      body: JSON.parse(process.env.TAMI_CHILD_BODY),
    });
    return new Response(JSON.stringify({ signedResponse }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };
  const order = await finalizeFromCallback('tami', JSON.parse(process.env.TAMI_CHILD_PAYLOAD));
  process.stdout.write(`\n${JSON.stringify({ status: order?.status ?? null })}\n`);
}

if (isCallbackChild) {
  await runCallbackChild();
}

if (!isCallbackChild) {
describe('Tami callback security', { concurrency: 1 }, () => {
  let computeCallbackHash;
  let signTamiResponse;
  let readTamiSignedResponse;
  let createTamiSignedRequest;
  let finalizeFromCallback;
  let saveOrder;
  let saveAttempt;
  let getOrderById;
  let completeCalls = 0;
  let queryCalls = 0;

  test('setup isolated callback fixtures', async () => {
    useFixtureEnv();
    writeDownloads();
    ({ computeCallbackHash, signTamiResponse, readTamiSignedResponse, createTamiSignedRequest } = await import(
      '../src/lib/payments/tami-crypto.ts'
    ));
    ({ finalizeFromCallback } = await import('../src/lib/payments/service.ts'));
    ({ saveOrder, saveAttempt, getOrderById } = await import('../src/lib/payments/orders.ts'));
    globalThis.fetch = async () => {
      throw new Error('bank_call_not_stubbed');
    };
  });

  function signedResponse(body) {
    return signTamiResponse({
      kid: 'fixture-kid',
      k: K_VALUE,
      merchantNumber: '10000001',
      terminalNumber: '20000002',
      body,
    });
  }

  function stubBank(options = {}) {
    completeCalls = 0;
    queryCalls = 0;
    globalThis.fetch = async (url, init) => {
      const href = String(url);
      assert.equal(href.startsWith('https://sandbox-paymentapi.tami.com.tr/api/v0/payment/'), true);
      assert.equal(init.headers['PG-Api-Version'], 'v4');
      const wire = JSON.parse(init.body);
      assert.equal(typeof wire.signedRequest, 'string');
      assert.equal(wire.signedRequest.split('.').length, 5);
      if (href.endsWith('/payment/complete-3ds')) {
        completeCalls += 1;
        if (options.timeout) throw new DOMException('The operation was aborted due to timeout', 'TimeoutError');
        if (options.delayMs) await new Promise((resolve) => setTimeout(resolve, options.delayMs));
        return new Response(JSON.stringify({ signedResponse: signedResponse(options.complete) }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      if (href.endsWith('/payment/orderQuery')) {
        queryCalls += 1;
        if (options.queryTimeout) throw new DOMException('The operation was aborted due to timeout', 'TimeoutError');
        return new Response(JSON.stringify({ signedResponse: signedResponse(options.query) }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      throw new Error(`unexpected_bank_call:${href}`);
    };
  }

  test('v4 request and response signatures follow the documented JOSE steps', () => {
    const request = createTamiSignedRequest({
      kid: 'fixture-kid',
      k: K_VALUE,
      merchantNumber: '10000001',
      terminalNumber: '20000002',
      body: { orderId: 'TGORDER1001' },
    });
    const parts = request.split('.');
    assert.equal(parts.length, 5);
    assert.equal(parts[1], '');
    const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
    assert.deepEqual(header, { alg: 'dir', enc: 'A256GCM', cty: 'JWT' });
    const encryptionKey = createHash('sha256').update(Buffer.from(K_VALUE, 'base64url')).digest();
    const decipher = createDecipheriv('aes-256-gcm', encryptionKey, Buffer.from(parts[2], 'base64url'));
    decipher.setAAD(Buffer.from(parts[0], 'ascii'));
    decipher.setAuthTag(Buffer.from(parts[4], 'base64url'));
    const inner = Buffer.concat([decipher.update(Buffer.from(parts[3], 'base64url')), decipher.final()]).toString('utf8');
    const claims = JSON.parse(Buffer.from(inner.split('.')[1], 'base64url').toString('utf8'));
    assert.equal(claims.iss, '10000001:20000002');
    assert.equal(claims.aud, 'tami');
    assert.equal(claims['tami:apiVersion'], 'v4');
    assert.deepEqual(claims['tami:body'], { orderId: 'TGORDER1001' });
    const response = signedResponse({ success: true, orderId: 'TGORDER1001', amount: 199, currency: 'TRY' });
    assert.deepEqual(readTamiSignedResponse(response, K_VALUE, '10000001', '20000002').orderId, 'TGORDER1001');
    const tampered = `${response.slice(0, -2)}aa`;
    assert.equal(readTamiSignedResponse(tampered, K_VALUE, '10000001', '20000002'), null);
    assert.equal(readTamiSignedResponse(request, K_VALUE, '10000001', '20000002'), null);
    assert.equal(readTamiSignedResponse(response, K_VALUE, '10000001', '99999999'), null);
  });

  function sign(overrides = {}) {
    const payload = {
      hashParams: HASH_PARAMS,
      cardOrganization: 'VISA',
      cardBrand: 'Bonus',
      cardType: 'CREDIT',
      maskedNumber: '450634******1234',
      installmentCount: '1',
      currencyCode: 'TRY',
      txnAmount: '199.00',
      orderId: 'TGORDER1001',
      systemTime: '2026-10-24T09:00:00',
      success: '1',
      mdStatus: '1',
      ...overrides,
      hashedData: '',
    };
    payload.hashedData = computeCallbackHash(payload, SECRET);
    return payload;
  }

  function stubComplete(body, options = {}) {
    stubBank({ complete: body, ...options });
  }

  async function settle(id, orderNumber, payload) {
    await saveOrder(orderRecord(id, orderNumber));
    return finalizeFromCallback('tami', payload);
  }

  test('valid callback marks the matching order paid and grants one download', async () => {
    const before = entitlementCount();
    stubComplete(bankSuccess('TGORDER1001'));
    const order = await settle('ord-valid', 'TGORDER1001', sign({ orderId: 'TGORDER1001' }));
    assert.equal(order?.status, 'paid');
    assert.equal(completeCalls, 1);
    assert.equal(entitlementCount(), before + 1);
  });

  test('unsigned callback is not paid and does not call the bank', async () => {
    const before = entitlementCount();
    completeCalls = 0;
    globalThis.fetch = async () => {
      completeCalls += 1;
      throw new Error('unsigned_callback_reached_bank');
    };
    const payload = sign({ orderId: 'TGORDER1002' });
    delete payload.hashedData;
    delete payload.hashParams;
    const order = await settle('ord-unsigned', 'TGORDER1002', payload);
    assert.equal(order?.status, 'awaiting_payment');
    assert.equal(readPayments().orders.find((item) => item.id === 'ord-unsigned')?.status, 'awaiting_payment');
    assert.equal(readPayments().audit.filter((item) => item.orderId === 'ord-unsigned').length, 0);
    assert.equal(completeCalls, 0);
    assert.equal(entitlementCount(), before);
  });

  test('unverified callback leaves the stored order, attempt and audit unchanged', async () => {
    const before = entitlementCount();
    completeCalls = 0;
    globalThis.fetch = async () => {
      completeCalls += 1;
      throw new Error('unverified_callback_reached_bank');
    };
    const order = orderRecord('ord-frozen', 'TGORDER1014');
    const attempt = attemptRecord('ord-frozen');
    await saveOrder(order);
    await saveAttempt(attempt);
    const payload = sign({ orderId: 'TGORDER1014' });
    delete payload.hashedData;
    delete payload.hashParams;
    const result = await finalizeFromCallback('tami', payload);
    const stored = readPayments();
    const storedOrder = stored.orders.find((item) => item.id === 'ord-frozen');
    const storedAttempt = stored.attempts.find((item) => item.id === attempt.id);
    assert.equal(result?.status, 'awaiting_payment');
    assert.equal(storedOrder?.status, 'awaiting_payment');
    assert.equal(storedOrder?.updatedAt, order.updatedAt);
    assert.equal(storedOrder?.paymentTransactionId, null);
    assert.equal(storedAttempt?.status, 'redirected');
    assert.equal(storedAttempt?.updatedAt, attempt.updatedAt);
    assert.equal(storedAttempt?.responseCode, null);
    assert.equal(stored.audit.filter((item) => item.orderId === 'ord-frozen').length, 0);
    assert.equal(completeCalls, 0);
    assert.equal(entitlementCount(), before);
  });

  test('invalid signature is not paid and does not call the bank', async () => {
    const before = entitlementCount();
    completeCalls = 0;
    globalThis.fetch = async () => {
      completeCalls += 1;
      throw new Error('invalid_signature_reached_bank');
    };
    const payload = sign({ orderId: 'TGORDER1003' });
    payload.hashedData = 'invalid-signature';
    const order = await settle('ord-bad-hash', 'TGORDER1003', payload);
    assert.equal(order?.status, 'awaiting_payment');
    assert.equal(readPayments().orders.find((item) => item.id === 'ord-bad-hash')?.status, 'awaiting_payment');
    assert.equal(completeCalls, 0);
    assert.equal(entitlementCount(), before);
  });

  test('wrong order id is not paid and does not call the bank', async () => {
    const before = entitlementCount();
    completeCalls = 0;
    globalThis.fetch = async () => {
      completeCalls += 1;
      throw new Error('wrong_order_reached_bank');
    };
    const payload = sign({ orderId: 'OTHERORDER9', token: 'ord-wrong' });
    const order = await settle('ord-wrong', 'TGORDER1004', payload);
    assert.equal(order?.status, 'awaiting_payment');
    assert.equal(readPayments().orders.find((item) => item.id === 'ord-wrong')?.status, 'awaiting_payment');
    assert.equal(completeCalls, 0);
    assert.equal(entitlementCount(), before);
  });

  test('wrong amount is not paid and does not call the bank', async () => {
    const before = entitlementCount();
    completeCalls = 0;
    globalThis.fetch = async () => {
      completeCalls += 1;
      throw new Error('wrong_amount_reached_bank');
    };
    const order = await settle('ord-amount', 'TGORDER1005', sign({ orderId: 'TGORDER1005', txnAmount: '1.00' }));
    assert.equal(order?.status, 'awaiting_payment');
    assert.equal(readPayments().orders.find((item) => item.id === 'ord-amount')?.status, 'awaiting_payment');
    assert.equal(completeCalls, 0);
    assert.equal(entitlementCount(), before);
  });

  test('wrong currency is not paid and does not call the bank', async () => {
    const before = entitlementCount();
    completeCalls = 0;
    globalThis.fetch = async () => {
      completeCalls += 1;
      throw new Error('wrong_currency_reached_bank');
    };
    const order = await settle('ord-currency', 'TGORDER1006', sign({ orderId: 'TGORDER1006', currencyCode: 'USD' }));
    assert.equal(order?.status, 'awaiting_payment');
    assert.equal(readPayments().orders.find((item) => item.id === 'ord-currency')?.status, 'awaiting_payment');
    assert.equal(completeCalls, 0);
    assert.equal(entitlementCount(), before);
  });

  test('missing bank fields are not paid and grant no download', async () => {
    const before = entitlementCount();
    stubComplete({ success: true });
    const order = await settle('ord-missing-status', 'TGORDER1007', sign({ orderId: 'TGORDER1007' }));
    assert.equal(order?.status, 'processing');
    assert.notEqual(order?.status, 'paid');
    assert.equal(completeCalls, 1);
    assert.equal(queryCalls, 0);
    assert.equal(entitlementCount(), before);
  });

  test('failed 3D completion is not paid', async () => {
    const before = entitlementCount();
    stubComplete({ success: false, errorCode: '1001', errorMessage: 'declined' });
    const order = await settle('ord-failed-3ds', 'TGORDER1012', sign({ orderId: 'TGORDER1012' }));
    assert.equal(order?.status, 'failed');
    assert.equal(completeCalls, 1);
    assert.equal(queryCalls, 0);
    assert.equal(entitlementCount(), before);
  });

  test('repeated callback finalizes the order once', async () => {
    const before = entitlementCount();
    stubComplete(bankSuccess('TGORDER1008'));
    const payload = sign({ orderId: 'TGORDER1008' });
    const first = await settle('ord-repeat', 'TGORDER1008', payload);
    const second = await finalizeFromCallback('tami', payload);
    assert.equal(first?.status, 'paid');
    assert.equal(second?.status, 'paid');
    assert.equal(second?.id, first?.id);
    assert.equal(completeCalls, 1);
    assert.equal(entitlementCount(), before + 1);
  });

  test('concurrent callbacks finalize the order once', async () => {
    const before = entitlementCount();
    stubComplete(bankSuccess('TGORDER1009'), { delayMs: 40 });
    const payload = sign({ orderId: 'TGORDER1009' });
    await saveOrder(orderRecord('ord-concurrent', 'TGORDER1009'));
    const [left, right] = await Promise.all([
      finalizeFromCallback('tami', payload),
      finalizeFromCallback('tami', payload),
    ]);
    assert.equal(left?.status, 'paid');
    assert.equal(right?.status, 'paid');
    assert.equal(left?.id, right?.id);
    assert.equal(completeCalls, 1);
    assert.equal(entitlementCount(), before + 1);
    const stored = await getOrderById('ord-concurrent');
    assert.equal(stored?.status, 'paid');
  });

  test('bank timeout reconciles once through order query and does not repeat collection', async () => {
    const before = entitlementCount();
    stubBank({
      timeout: true,
      query: {
        success: true,
        content: [
          {
            orderId: 'TGORDER1010',
            amount: 199,
            currency: 'TRY',
            orderStatus: 'AUTH',
            paymentStatus: 'SUCCESS',
          },
        ],
      },
    });
    const paid = await settle('ord-timeout', 'TGORDER1010', sign({ orderId: 'TGORDER1010' }));
    assert.equal(paid?.status, 'paid');
    assert.equal(completeCalls, 1);
    assert.equal(queryCalls, 1);
    assert.equal(entitlementCount(), before + 1);

    stubBank({ timeout: true, queryTimeout: true });
    const unknown = await settle('ord-timeout-unknown', 'TGORDER1013', sign({ orderId: 'TGORDER1013' }));
    assert.equal(unknown?.status, 'processing');
    assert.notEqual(unknown?.status, 'paid');
    assert.equal(completeCalls, 1);
    assert.equal(queryCalls, 1);
    assert.equal(entitlementCount(), before + 1);
  });

  test('two processes finalize one Tami callback once', async () => {
    const before = entitlementCount();
    const orderNumber = 'TGORDER1011';
    const payload = sign({ orderId: orderNumber });
    await saveOrder(orderRecord('ord-multiprocess', orderNumber));
    const calls = join(dir, 'bank-calls.log');
    writeFileSync(calls, '');
    const childEnv = {
      ...process.env,
      TAMI_CALLBACK_CHILD: '1',
      TAMI_CALL_LOG: calls,
      TAMI_CHILD_PAYLOAD: JSON.stringify(payload),
      TAMI_CHILD_BODY: JSON.stringify(bankSuccess(orderNumber)),
    };
    const run = () =>
      new Promise((resolve, reject) => {
        const child = spawn(process.execPath, [fileURLToPath(import.meta.url)], { env: childEnv });
        let stdout = '';
        let stderr = '';
        child.stdout.on('data', (chunk) => {
          stdout += chunk;
        });
        child.stderr.on('data', (chunk) => {
          stderr += chunk;
        });
        child.on('exit', (code) => {
          const line = stdout
            .trim()
            .split('\n')
            .filter((item) => item.startsWith('{"status":'))
            .pop();
          if (code === 0 && line) resolve(JSON.parse(line));
          else reject(new Error(stderr || stdout || `child_exit_${code}`));
        });
      });
    const [left, right] = await Promise.all([run(), run()]);
    assert.equal(left.status, 'paid');
    assert.equal(right.status, 'paid');
    const logged = readFileSync(calls, 'utf8').trim().split('\n').filter(Boolean);
    assert.equal(logged.length, 1);
    assert.equal(logged[0].endsWith('/api/v0/payment/complete-3ds'), true);
    assert.equal(entitlementCount(), before + 1);
    const stored = await getOrderById('ord-multiprocess');
    assert.equal(stored?.status, 'paid');
  });

  test('cleanup callback fixtures', () => {
    restoreEnv();
    rmSync(dir, { recursive: true, force: true });
    assert.equal(process.env.TAMI_ENABLED, savedEnv.TAMI_ENABLED);
  });
});
}
