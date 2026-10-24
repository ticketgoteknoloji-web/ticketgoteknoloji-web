import './register-src-hooks.mjs';

import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import {
  assertIsolatedDataFile,
  assertSafeCallback,
  assertSandboxPaymentUrl,
  reconcileSandboxOrder,
  SANDBOX_ORIGIN,
} from './tami-sandbox-plan.mjs';

const source = readFileSync(new URL('./tami-sandbox-plan.mjs', import.meta.url), 'utf8');

test('sandbox plan can call only the sandbox query endpoint', () => {
  assert.equal(SANDBOX_ORIGIN, 'https://sandbox-paymentapi.tami.com.tr');
  assert.match(source, /\/api\/v0\/payment\/orderQuery/);
  assert.doesNotMatch(source, /\/payment\/auth/);
  assert.doesNotMatch(source, /\/payment\/complete-3ds/);
  assert.equal(assertSandboxPaymentUrl(`${SANDBOX_ORIGIN}/api/v0/payment/orderQuery`).host, 'sandbox-paymentapi.tami.com.tr');
  assert.throws(() => assertSandboxPaymentUrl('https://paymentapi.tami.com.tr/api/v0/payment/auth'), /sandbox_host_required/);
  assert.throws(() => assertSandboxPaymentUrl('http://sandbox-paymentapi.tami.com.tr/api/v0/payment/orderQuery'), /sandbox_host_required/);
});

test('sandbox callback and payment files stay away from production', () => {
  const dir = mkdtempSync(join(tmpdir(), 'tami-plan-'));
  process.env.TAMI_SANDBOX_PLAN_DIR = dir;
  try {
    assert.throws(() => assertSafeCallback('https://www.ticketgoteknoloji.com/api/payments/tami/callback'), /callback_not_isolated/);
    assert.throws(() => assertSafeCallback('https://sandbox-pay.example.com/api/payments/tami/callback'.replace('sandbox-pay.example.com', 'ticketgoteknoloji.com')), /callback_not_isolated/);
    assert.equal(assertSafeCallback('https://sandbox-pay.example.com/api/payments/tami/callback').pathname, '/api/payments/tami/callback');
    assert.equal(assertIsolatedDataFile(join(dir, 'payments.json'), 'payments'), join(dir, 'payments.json'));
    assert.throws(() => assertIsolatedDataFile(join(process.cwd(), '.data', 'payments.json'), 'payments'), /payments_uses_project_data|payments_outside_plan_dir/);
  } finally {
    delete process.env.TAMI_SANDBOX_PLAN_DIR;
    rmSync(dir, { recursive: true, force: true });
  }
});

test('failed and ambiguous bank results do not qualify for a download', () => {
  const failed = reconcileSandboxOrder(
    { orderNumber: 'TGPLAN1', status: 'failed', amount: 199, currency: 'TRY', entitlements: 0 },
    { orderId: 'TGPLAN1', amount: 199, currency: 'TRY', success: false, paymentStatus: 'FAIL', orderStatus: 'AUTH' }
  );
  const ambiguous = reconcileSandboxOrder(
    { orderNumber: 'TGPLAN2', status: 'processing', amount: 199, currency: 'TRY', entitlements: 0 },
    { orderId: 'TGPLAN2', amount: 199, currency: 'TRY', success: true, paymentStatus: null, orderStatus: null }
  );
  const paidWithoutProof = reconcileSandboxOrder(
    { orderNumber: 'TGPLAN3', status: 'paid', amount: 199, currency: 'TRY', entitlements: 1 },
    { orderId: 'TGPLAN3', amount: 199, currency: 'TRY', success: true, paymentStatus: null, orderStatus: null }
  );
  assert.equal(failed.entitlementBlocked, true);
  assert.equal(failed.paidRequiresProof, true);
  assert.equal(ambiguous.entitlementBlocked, true);
  assert.equal(ambiguous.paidRequiresProof, true);
  assert.equal(paidWithoutProof.entitlementBlocked, false);
  assert.equal(paidWithoutProof.paidRequiresProof, false);
  assert.equal(paidWithoutProof.ready, false);
});
