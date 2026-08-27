import { mkdir, readFile, rename, writeFile } from 'fs/promises';
import path from 'path';
import { randomBytes } from 'crypto';
import type { OrderRecord, PaymentAttempt, PaymentAuditEntry } from '@/lib/payments/types';

const DATA_DIR = path.join(process.cwd(), '.data');
const FILE = path.join(DATA_DIR, 'payments.json');
const LEGACY = path.join(DATA_DIR, 'orders.json');

type PaymentDb = {
  orders: OrderRecord[];
  attempts: PaymentAttempt[];
  audit: PaymentAuditEntry[];
};

let queue: Promise<unknown> = Promise.resolve();

function enqueue<T>(work: () => Promise<T>): Promise<T> {
  const run = queue.then(work, work);
  queue = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

function emptyDb(): PaymentDb {
  return { orders: [], attempts: [], audit: [] };
}

function normalizeAttempt(raw: PaymentAttempt): PaymentAttempt {
  return {
    ...raw,
    amountMinor: raw.amountMinor ?? 0,
    currency: raw.currency ?? 'USD',
    installment: raw.installment ?? 1,
    cardProgram: raw.cardProgram ?? null,
    providerTransactionId: raw.providerTransactionId ?? null,
    responseCode: raw.responseCode ?? null,
    mdStatus: raw.mdStatus ?? null,
    bankReference: raw.bankReference ?? null,
  };
}

function normalizeOrder(raw: OrderRecord): OrderRecord {
  const status =
    raw.status === 'payment_started' ? 'awaiting_payment' : raw.status;
  return {
    ...raw,
    status,
    unitAmountMinor: raw.unitAmountMinor ?? Math.round(raw.subtotalMinor / Math.max(1, raw.quantity)),
    vatRatePercent: raw.vatRatePercent ?? (raw.vatMinor > 0 && raw.subtotalMinor > 0
      ? Math.round((raw.vatMinor / raw.subtotalMinor) * 100)
      : 20),
    providerConversationId: raw.providerConversationId ?? raw.id,
    paymentTransactionId: raw.paymentTransactionId ?? null,
    customerName: raw.customerName ?? `${raw.customer.firstName} ${raw.customer.lastName}`.trim(),
    customerPhone: raw.customerPhone ?? raw.customer.phone,
    statusToken: raw.statusToken ?? randomBytes(18).toString('hex'),
    paidAt: raw.paidAt ?? (status === 'paid' ? raw.updatedAt : null),
    distanceSalesVersion: raw.distanceSalesVersion ?? raw.legalAcceptance?.distanceSalesVersion ?? '',
    preInformationVersion: raw.preInformationVersion ?? raw.legalAcceptance?.preInformationVersion ?? '',
    legalAcceptedAt: raw.legalAcceptedAt ?? raw.legalAcceptance?.acceptedAt ?? raw.createdAt,
    originalAmountMinor: raw.originalAmountMinor ?? raw.amountMinor,
    originalCurrency: raw.originalCurrency ?? 'USD',
    exchangeRate: raw.exchangeRate ?? null,
    exchangeRateSource: raw.exchangeRateSource ?? null,
    exchangeRateDate: raw.exchangeRateDate ?? null,
    chargedAmountMinor: raw.chargedAmountMinor ?? null,
    chargedCurrency: raw.chargedCurrency ?? null,
  };
}

async function readDb(): Promise<PaymentDb> {
  try {
    const raw = await readFile(FILE, 'utf8');
    const parsed = JSON.parse(raw) as Partial<PaymentDb>;
    return {
      orders: Array.isArray(parsed.orders) ? parsed.orders.map(normalizeOrder) : [],
      attempts: Array.isArray(parsed.attempts) ? parsed.attempts.map(normalizeAttempt) : [],
      audit: Array.isArray(parsed.audit) ? parsed.audit : [],
    };
  } catch {
    try {
      const legacy = JSON.parse(await readFile(LEGACY, 'utf8')) as OrderRecord[];
      return {
        orders: Array.isArray(legacy) ? legacy.map(normalizeOrder) : [],
        attempts: [],
        audit: [],
      };
    } catch {
      return emptyDb();
    }
  }
}

async function writeDb(db: PaymentDb): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  const tmp = `${FILE}.${randomBytes(4).toString('hex')}.tmp`;
  await writeFile(tmp, JSON.stringify(db, null, 2), 'utf8');
  await rename(tmp, FILE);
}

export function createOrderId(): string {
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
  return `TG-${stamp}-${randomBytes(3).toString('hex').toUpperCase()}`;
}

export function createAttemptId(): string {
  return `PA-${randomBytes(8).toString('hex')}`;
}

export async function saveOrder(order: OrderRecord): Promise<OrderRecord> {
  return enqueue(async () => {
    const db = await readDb();
    const next = normalizeOrder(order);
    const index = db.orders.findIndex((item) => item.id === next.id);
    if (index >= 0) db.orders[index] = next;
    else db.orders.push(next);
    await writeDb(db);
    return next;
  });
}

export async function getOrderById(id: string): Promise<OrderRecord | null> {
  const db = await readDb();
  return db.orders.find((item) => item.id === id || item.orderNumber === id) ?? null;
}

export async function getOrderByProviderToken(token: string): Promise<OrderRecord | null> {
  if (!token) return null;
  const db = await readDb();
  return (
    db.orders.find(
      (item) =>
        item.providerToken === token ||
        item.providerPaymentId === token ||
        item.providerConversationId === token
    ) ?? null
  );
}

export async function getOrderByIdempotency(key: string): Promise<OrderRecord | null> {
  if (!key || key.length < 16) return null;
  const db = await readDb();
  return db.orders.find((item) => item.idempotencyKey === key) ?? null;
}

export async function updateOrder(id: string, patch: Partial<OrderRecord>): Promise<OrderRecord | null> {
  return enqueue(async () => {
    const db = await readDb();
    const index = db.orders.findIndex((item) => item.id === id);
    if (index < 0) return null;
    const current = db.orders[index];
    if (current.status === 'paid' && patch.status && patch.status !== 'paid' && patch.status !== 'refunded') {
      await writeDb(db);
      return current;
    }
    const next = normalizeOrder({ ...current, ...patch, updatedAt: new Date().toISOString() });
    db.orders[index] = next;
    await writeDb(db);
    return next;
  });
}

export async function saveAttempt(attempt: PaymentAttempt): Promise<PaymentAttempt> {
  return enqueue(async () => {
    const db = await readDb();
    const index = db.attempts.findIndex((item) => item.id === attempt.id);
    if (index >= 0) db.attempts[index] = attempt;
    else db.attempts.push(attempt);
    await writeDb(db);
    return attempt;
  });
}

export async function updateAttempt(id: string, patch: Partial<PaymentAttempt>): Promise<PaymentAttempt | null> {
  return enqueue(async () => {
    const db = await readDb();
    const index = db.attempts.findIndex((item) => item.id === id);
    if (index < 0) return null;
    const next = { ...db.attempts[index], ...patch, updatedAt: new Date().toISOString() };
    db.attempts[index] = next;
    await writeDb(db);
    return next;
  });
}

export async function getAttemptById(id: string): Promise<PaymentAttempt | null> {
  const db = await readDb();
  return db.attempts.find((item) => item.id === id) ?? null;
}

export async function getLatestAttempt(orderId: string): Promise<PaymentAttempt | null> {
  const db = await readDb();
  const items = db.attempts.filter((item) => item.orderId === orderId);
  return items.at(-1) ?? null;
}

export async function appendAudit(entry: Omit<PaymentAuditEntry, 'id' | 'createdAt'> & { id?: string; createdAt?: string }): Promise<void> {
  await enqueue(async () => {
    const db = await readDb();
    db.audit.push({
      id: entry.id ?? `AUD-${randomBytes(6).toString('hex')}`,
      createdAt: entry.createdAt ?? new Date().toISOString(),
      orderId: entry.orderId,
      attemptId: entry.attemptId,
      provider: entry.provider,
      event: entry.event,
      status: entry.status,
      providerReference: entry.providerReference,
      responseCode: entry.responseCode,
    });
    if (db.audit.length > 5000) db.audit = db.audit.slice(-4000);
    await writeDb(db);
  });
}

export async function listOrders(): Promise<OrderRecord[]> {
  return (await readDb()).orders;
}
