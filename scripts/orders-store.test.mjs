import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import './register-src-hooks.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const ordersUrl = pathToFileURL(join(root, 'src/lib/payments/orders.ts')).href;
const storeUrl = pathToFileURL(join(root, 'src/lib/downloads/store.ts')).href;
const configUrl = pathToFileURL(join(root, 'src/lib/downloads/config.ts')).href;

function sampleOrder(id) {
  const now = '2026-10-23T09:00:00.000Z';
  return {
    id,
    orderNumber: id,
    productId: 'pkg',
    productName: 'Paket',
    description: 'Kayit',
    quantity: 1,
    period: 'once',
    currency: 'USD',
    unitAmountMinor: 100,
    subtotalMinor: 100,
    vatMinor: 20,
    vatRatePercent: 20,
    amountMinor: 120,
    status: 'pending',
    paymentProvider: null,
    providerPaymentId: null,
    providerConversationId: null,
    providerToken: null,
    paymentTransactionId: null,
    customerName: 'Test User',
    customerEmail: 'test@example.com',
    customerPhone: '+905551112233',
    customer: {
      firstName: 'Test',
      lastName: 'User',
      email: 'test@example.com',
      phone: '+905551112233',
      identityNumber: '10000000146',
      address: 'Adres',
      city: 'Istanbul',
      country: 'TR',
      billingType: 'individual',
    },
    idempotencyKey: `idempotency-${id}-key`,
    statusToken: `status-${id}`,
    paidAt: null,
    distanceSalesVersion: '1',
    preInformationVersion: '1',
    legalAcceptedAt: now,
    createdAt: now,
    updatedAt: now,
  };
}

function runChild(env) {
  const source = `
    const kind = process.env.STORE_KIND;
    if (kind === 'order') {
      const { saveOrder } = await import(${JSON.stringify(ordersUrl)});
      await saveOrder(JSON.parse(process.env.ORDER_JSON));
    } else {
      const { saveUploadedPackage } = await import(${JSON.stringify(storeUrl)});
      await saveUploadedPackage(JSON.parse(process.env.PACKAGE_JSON), 'admin@example.com');
    }
  `;
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--import', join(root, 'scripts/register-src-hooks.mjs'), '--input-type=module', '--eval', source], {
      cwd: root,
      env: { ...process.env, ...env },
    });
    let err = '';
    child.stderr.on('data', (chunk) => {
      err += chunk;
    });
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(err || `child exit ${code}`));
    });
  });
}

function oldOrderReader(file) {
  const db = JSON.parse(readFileSync(file, 'utf8'));
  if (!db || !Array.isArray(db.orders) || !Array.isArray(db.attempts) || !Array.isArray(db.audit)) {
    throw new Error('old reader rejected the file');
  }
  return db.orders.map((order) => order.id);
}

test('payment and download files keep the cwd default and reject relative paths', async () => {
  const previousOrders = process.env.PAYMENT_ORDERS_FILE;
  const previousDownloads = process.env.DOWNLOAD_DATA_FILE;
  delete process.env.PAYMENT_ORDERS_FILE;
  delete process.env.DOWNLOAD_DATA_FILE;
  const { paymentOrdersPath } = await import(ordersUrl);
  const { downloadsDataPath } = await import(configUrl);
  assert.equal(paymentOrdersPath(), join(process.cwd(), '.data', 'payments.json'));
  assert.equal(downloadsDataPath(), join(process.cwd(), '.data', 'downloads.json'));
  process.env.PAYMENT_ORDERS_FILE = 'relative/payments.json';
  await assert.rejects(async () => paymentOrdersPath(), (error) => error.code === 'path_not_absolute');
  process.env.DOWNLOAD_DATA_FILE = 'relative/downloads.json';
  await assert.rejects(async () => downloadsDataPath());
  if (previousOrders === undefined) delete process.env.PAYMENT_ORDERS_FILE;
  else process.env.PAYMENT_ORDERS_FILE = previousOrders;
  if (previousDownloads === undefined) delete process.env.DOWNLOAD_DATA_FILE;
  else process.env.DOWNLOAD_DATA_FILE = previousDownloads;
});

test('concurrent writers keep every order and the previous schema stays readable', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'tg-orders-'));
  const file = join(dir, 'payments.json');
  const previous = process.env.PAYMENT_ORDERS_FILE;
  process.env.PAYMENT_ORDERS_FILE = file;
  try {
    writeFileSync(file, JSON.stringify({ orders: [sampleOrder('existing-1')] }));
    const { saveOrder, listOrders } = await import(ordersUrl);
    await saveOrder(sampleOrder('local-2'));
    await Promise.all([1, 2, 3, 4, 5, 6].map((n) => runChild({
      STORE_KIND: 'order',
      PAYMENT_ORDERS_FILE: file,
      ORDER_JSON: JSON.stringify(sampleOrder(`proc-${n}`)),
    })));
    const ids = oldOrderReader(file);
    for (const id of ['existing-1', 'local-2', 'proc-1', 'proc-2', 'proc-3', 'proc-4', 'proc-5', 'proc-6']) {
      assert.equal(ids.includes(id), true);
    }
    assert.equal((await listOrders()).length, ids.length);
    assert.equal(existsSync(`${file}.lock`), false);
  } finally {
    if (previous === undefined) delete process.env.PAYMENT_ORDERS_FILE;
    else process.env.PAYMENT_ORDERS_FILE = previous;
    rmSync(dir, { recursive: true, force: true });
  }
});

test('invalid or unreadable payment files are not replaced', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'tg-orders-bad-'));
  const file = join(dir, 'payments.json');
  const previous = process.env.PAYMENT_ORDERS_FILE;
  process.env.PAYMENT_ORDERS_FILE = file;
  try {
    const broken = '{"orders":';
    writeFileSync(file, broken);
    writeFileSync(join(dir, 'orders.json'), JSON.stringify([sampleOrder('legacy-1')]));
    const { saveOrder } = await import(ordersUrl);
    await assert.rejects(() => saveOrder(sampleOrder('new-1')), (error) => error.code === 'invalid');
    assert.equal(readFileSync(file, 'utf8'), broken);
    assert.equal(JSON.parse(readFileSync(join(dir, 'orders.json'), 'utf8'))[0].id, 'legacy-1');
    chmodSync(file, 0o000);
    await assert.rejects(() => saveOrder(sampleOrder('new-2')), (error) => error.code === 'unreadable' || error.code === 'invalid');
    chmodSync(file, 0o600);
    assert.equal(readFileSync(file, 'utf8'), broken);
  } finally {
    try { chmodSync(file, 0o600); } catch { /* already restored */ }
    if (previous === undefined) delete process.env.PAYMENT_ORDERS_FILE;
    else process.env.PAYMENT_ORDERS_FILE = previous;
    rmSync(dir, { recursive: true, force: true });
  }
});

test('a stale lock does not block a new order', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'tg-orders-lock-'));
  const file = join(dir, 'payments.json');
  const lock = `${file}.lock`;
  const previous = process.env.PAYMENT_ORDERS_FILE;
  process.env.PAYMENT_ORDERS_FILE = file;
  try {
    mkdirSync(lock);
    writeFileSync(join(lock, 'owner'), '999999\n');
    const past = new Date(Date.now() - 5_000);
    utimesSync(lock, past, past);
    const { saveOrder } = await import(ordersUrl);
    await saveOrder(sampleOrder('after-stale'));
    assert.deepEqual(oldOrderReader(file), ['after-stale']);
    assert.equal(existsSync(lock), false);
  } finally {
    if (previous === undefined) delete process.env.PAYMENT_ORDERS_FILE;
    else process.env.PAYMENT_ORDERS_FILE = previous;
    rmSync(dir, { recursive: true, force: true });
  }
});

test('concurrent download catalog writes keep every package', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'tg-downloads-'));
  const file = join(dir, 'downloads.json');
  const previous = process.env.DOWNLOAD_DATA_FILE;
  process.env.DOWNLOAD_DATA_FILE = file;
  try {
    const jobs = [1, 2, 3, 4].map((n) => runChild({
      STORE_KIND: 'download',
      DOWNLOAD_DATA_FILE: file,
      PACKAGE_JSON: JSON.stringify({
        id: `dl-${n}`,
        productId: `product-${n}`,
        name: `Paket ${n}`,
        description: 'Kayit',
        platforms: ['windows'],
        platform: 'Windows',
        version: '1',
        architecture: 'Universal',
        fileType: 'TXT',
        mimeType: 'text/plain',
        fileSize: '1 B',
        fileSizeBytes: 1,
        priceUsd: 0,
        currency: 'USD',
        storedFileName: `file-${n}.txt`,
        originalFileName: `file-${n}.txt`,
        storageRelativePath: `file-${n}.txt`,
        checksumSha256: 'abc',
        uploadedAt: '2026-10-23T09:00:00.000Z',
        uploadedBy: 'admin@example.com',
        published: true,
        status: 'published',
        saleOpen: false,
      }),
    }));
    await Promise.all(jobs);
    const db = JSON.parse(readFileSync(file, 'utf8'));
    const ids = db.packages.map((item) => item.productId).sort();
    assert.deepEqual(ids, ['product-1', 'product-2', 'product-3', 'product-4']);
    assert.equal(Array.isArray(db.entitlements), true);
    assert.equal(existsSync(`${file}.lock`), false);
  } finally {
    if (previous === undefined) delete process.env.DOWNLOAD_DATA_FILE;
    else process.env.DOWNLOAD_DATA_FILE = previous;
    rmSync(dir, { recursive: true, force: true });
  }
});

test('missing payment file still accepts the first order', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'tg-orders-new-'));
  const file = join(dir, 'nested', 'payments.json');
  const previous = process.env.PAYMENT_ORDERS_FILE;
  process.env.PAYMENT_ORDERS_FILE = file;
  try {
    const { saveOrder } = await import(ordersUrl);
    await saveOrder(sampleOrder('first'));
    assert.equal(statSync(file).isFile(), true);
    assert.deepEqual(oldOrderReader(file), ['first']);
  } finally {
    if (previous === undefined) delete process.env.PAYMENT_ORDERS_FILE;
    else process.env.PAYMENT_ORDERS_FILE = previous;
    rmSync(dir, { recursive: true, force: true });
  }
});
