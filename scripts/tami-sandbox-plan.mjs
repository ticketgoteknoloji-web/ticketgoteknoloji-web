/**
 * Tami sandbox 3D plan and preflight.
 * Calls only sandbox-paymentapi orderQuery. Does not start a payment.
 * Does not read .env.local and does not write project .data files.
 */
import './register-src-hooks.mjs';

import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createTamiSignedRequest, generatePgAuthToken, readTamiSignedResponse } from '../src/lib/payments/tami-crypto.ts';

export const SANDBOX_ORIGIN = 'https://sandbox-paymentapi.tami.com.tr';
export const PRODUCTION_PAYMENT_HOST = 'paymentapi.tami.com.tr';
export const PRODUCTION_CALLBACK_HOSTS = new Set(['www.ticketgoteknoloji.com', 'ticketgoteknoloji.com']);

export function planDir() {
  return process.env.TAMI_SANDBOX_PLAN_DIR || '/tmp/tami-sandbox-plan';
}

const QUERY_PATH = '/api/v0/payment/orderQuery';

export function assertSandboxPaymentUrl(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.host !== 'sandbox-paymentapi.tami.com.tr') {
    throw new Error('sandbox_host_required');
  }
  if (url.host === PRODUCTION_PAYMENT_HOST) throw new Error('production_host_forbidden');
  return url;
}

export function assertSafeCallback(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || PRODUCTION_CALLBACK_HOSTS.has(url.host) || url.host === PRODUCTION_PAYMENT_HOST) {
    throw new Error('callback_not_isolated');
  }
  if (!url.pathname.endsWith('/api/payments/tami/callback')) throw new Error('callback_path_required');
  return url;
}

export function assertIsolatedDataFile(file, label) {
  if (!file || !file.startsWith('/')) throw new Error(`${label}_not_absolute`);
  const normalized = file.replace(/\\/g, '/');
  if (normalized.includes('/.data/') || normalized.endsWith('/.data')) throw new Error(`${label}_uses_project_data`);
  if (!normalized.startsWith(`${planDir()}/`)) throw new Error(`${label}_outside_plan_dir`);
  return normalized;
}

export function reconcileSandboxOrder(local, bank) {
  const entitlementBlocked = local.status !== 'paid' && local.entitlements === 0;
  const paidRequiresProof =
    local.status !== 'paid' ||
    (bank.success === true &&
      bank.orderId === local.orderNumber &&
      bank.currency === 'TRY' &&
      local.currency === 'TRY' &&
      bank.amount === local.amount &&
      bank.paymentStatus === 'SUCCESS' &&
      bank.orderStatus === 'AUTH');
  return {
    orderMatch: Boolean(local.orderNumber) && local.orderNumber === bank.orderId,
    amountMatch: local.currency === 'TRY' && bank.currency === 'TRY' && local.amount === bank.amount,
    entitlementBlocked,
    paidRequiresProof,
    ready: Boolean(local.orderNumber) && local.orderNumber === bank.orderId && entitlementBlocked && paidRequiresProof,
  };
}

function decodeEntities(value) {
  return value.replace(/&quot;/g, '"').replace(/&#34;/g, '"').replace(/&amp;/g, '&');
}

async function loadSandboxSample() {
  const requestHtml = await (await fetch('https://dev.tami.com.tr/istek-tokeni-olusturma', { headers: { 'User-Agent': 'Mozilla/5.0' } })).text();
  const queryHtml = await (await fetch('https://dev.tami.com.tr/tami-islem-sorgulama', { headers: { 'User-Agent': 'Mozilla/5.0' } })).text();
  const decoded = decodeEntities(requestHtml).replace(/\\n/g, '\n').replace(/\\"/g, '"');
  const start = decoded.indexOf('"kty"');
  const jwk = JSON.parse(decoded.slice(decoded.lastIndexOf('{', start), decoded.indexOf('}', start) + 1));
  const secret = queryHtml.match(/Secret Key[\s\S]{0,500}?([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i)?.[1] ?? '';
  if (jwk.kty !== 'oct' || !jwk.k || !jwk.kid || !secret) throw new Error('sandbox_sample_incomplete');
  return { jwk, secret, merchant: '77006950', terminal: '84006953' };
}

async function sandboxQuery(sample, body) {
  const url = assertSandboxPaymentUrl(`${SANDBOX_ORIGIN}${QUERY_PATH}`);
  const signedRequest = createTamiSignedRequest({
    kid: sample.jwk.kid,
    k: sample.jwk.k,
    merchantNumber: sample.merchant,
    terminalNumber: sample.terminal,
    body,
  });
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'Accept-Language': 'tr',
      'PG-Api-Version': 'v4',
      'PG-Auth-Token': generatePgAuthToken(sample.merchant, sample.terminal, sample.secret),
      correlationId: `Correlation${createHash('sha256').update(`${Date.now()}${Math.random()}`).digest('hex').slice(0, 32)}`,
    },
    body: JSON.stringify({ signedRequest }),
  });
  const parsed = await response.json();
  const token = typeof parsed.signedResponse === 'string' ? parsed.signedResponse : '';
  const verified = token ? readTamiSignedResponse(token, sample.jwk.k, sample.merchant, sample.terminal) : null;
  return {
    httpStatus: response.status,
    wireKeys: Object.keys(parsed).sort(),
    parts: token ? token.split('.').length : 0,
    verified: Boolean(verified),
    success: verified ? verified.success === true : parsed.success === false ? false : null,
    errorCode: parsed.errorCode == null ? '' : String(parsed.errorCode),
    contentCount: verified && Array.isArray(verified.content) ? verified.content.length : null,
  };
}

export async function prepareSandboxPlan() {
  if (process.argv.includes('--start') || process.env.TAMI_SANDBOX_ARM === '1') {
    return { started: false, readyToStart: false, reason: 'auth_call_disabled', productionRequests: 0 };
  }
  const paymentsFile = assertIsolatedDataFile(join(planDir(), 'payments.json'), 'payments');
  const downloadsFile = assertIsolatedDataFile(join(planDir(), 'downloads.json'), 'downloads');
  mkdirSync(planDir(), { recursive: true });
  writeFileSync(paymentsFile, `${JSON.stringify({ orders: [], attempts: [], audit: [] }, null, 2)}\n`);
  writeFileSync(downloadsFile, `${JSON.stringify({ packages: [], entitlements: [], audit: [] }, null, 2)}\n`);

  const sample = await loadSandboxSample();
  const emptyWindow = await sandboxQuery(sample, {
    startDate: '01-01-2020 00:00:00',
    endDate: '01-01-2020 00:10:00',
    isTransactionDetail: false,
    page: 0,
    size: 1,
  });
  const missingOrder = await sandboxQuery(sample, { orderId: 'TGSANDBOXPLAN1', isTransactionDetail: false });
  const callbackCandidate = process.env.TAMI_SANDBOX_CALLBACK_URL?.trim() || '';
  let callbackReady = false;
  if (callbackCandidate) {
    try {
      assertSafeCallback(callbackCandidate);
      callbackReady = true;
    } catch {
      callbackReady = false;
    }
  }

  const credentialAuthorized = emptyWindow.httpStatus === 200 && emptyWindow.parts === 3 && emptyWindow.verified === true && emptyWindow.success === true;
  const blockers = [];
  if (!credentialAuthorized) blockers.push('sandbox_credential_not_authorized');
  if (!callbackReady) blockers.push('isolated_https_callback_missing');
  blockers.push('sale_authority_unproven');
  blockers.push('auth_not_started');

  const report = {
    phase: 'prepared',
    started: false,
    readyToStart: false,
    productionRequests: 0,
    sandboxOrigin: SANDBOX_ORIGIN,
    apiVersion: 'v4',
    credentialAuthorized,
    queryEnvelope: emptyWindow.parts === 3 && emptyWindow.verified ? 'jwt' : 'unverified',
    missingOrderErrorCode: missingOrder.errorCode,
    callbackReady,
    dataFiles: { paymentsFile, downloadsFile },
    card: {
      source: 'https://dev.tami.com.tr/test-kartlari',
      bank: 'Garanti BBVA',
      type: 'Bonus Kredi Kartı',
      last4: '1173',
      expiry: '04/27',
      storedInRepo: false,
    },
    steps: [
      'sandbox auth returns threeDSHtmlContent and is not treated as paid',
      'browser posts the 3D result only to the isolated callback',
      'complete-3ds requires success, order id, amount and TRY',
      'timeout performs one orderQuery and does not send a second auth',
      'paid local status requires query paymentStatus SUCCESS and orderStatus AUTH',
      'failed and ambiguous results leave entitlements empty',
      'repeat and two-process callbacks create one bank completion',
    ],
    local: { orderNumber: null, status: null, amount: null, currency: null, entitlements: 0 },
    bank: { orderId: null, amount: null, currency: null, success: null, paymentStatus: null, orderStatus: null },
    reconciliation: reconcileSandboxOrder(
      { orderNumber: null, status: null, amount: null, currency: null, entitlements: 0 },
      { orderId: null, amount: null, currency: null, success: null, paymentStatus: null, orderStatus: null }
    ),
    blockers,
  };
  writeFileSync(join(planDir(), 'reconciliation.json'), `${JSON.stringify(report, null, 2)}\n`);
  return report;
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  const report = await prepareSandboxPlan();
  const publicReport = {
    phase: report.phase,
    started: report.started,
    readyToStart: report.readyToStart,
    reason: report.reason,
    productionRequests: report.productionRequests,
    credentialAuthorized: report.credentialAuthorized,
    queryEnvelope: report.queryEnvelope,
    missingOrderErrorCode: report.missingOrderErrorCode,
    callbackReady: report.callbackReady,
    blockers: report.blockers,
    cardLast4: report.card?.last4,
    cardExpiry: report.card?.expiry,
  };
  console.log(JSON.stringify(publicReport));
  if (report.reason === 'auth_call_disabled') process.exit(2);
}
