import path from 'path';
import { randomBytes } from 'crypto';
import { DataFileError, readJsonFile, resolveAbsoluteDataFile, withLockedUpdate, writeJsonAtomic } from '@/lib/persistence/locked-json';
import type { OrderRecord, PaymentAttempt, PaymentAuditEntry } from '@/lib/payments/types';

export function paymentOrdersPath(): string {
  return resolveAbsoluteDataFile(process.env.PAYMENT_ORDERS_FILE, path.join(process.cwd(), '.data', 'payments.json'));
}

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

function parsePaymentDb(value: unknown): PaymentDb {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new DataFileError('invalid', 'Payment store schema is invalid');
  }
  const record = value as Partial<PaymentDb>;
  if (!Array.isArray(record.orders)) {
    throw new DataFileError('invalid', 'Payment store schema is invalid');
  }
  return {
    orders: record.orders.map(normalizeOrder),
    attempts: Array.isArray(record.attempts) ? record.attempts.map(normalizeAttempt) : [],
    audit: Array.isArray(record.audit) ? record.audit : [],
  };
}

async function readDb(): Promise<PaymentDb> {
  const file = paymentOrdersPath();
  const loaded = await readJsonFile(file);
  if (!loaded.missing) return parsePaymentDb(loaded.value);
  const legacy = await readJsonFile(path.join(path.dirname(file), 'orders.json'));
  if (legacy.missing) return emptyDb();
  if (!Array.isArray(legacy.value)) {
    throw new DataFileError('invalid', 'Legacy order file is invalid');
  }
  return {
    orders: legacy.value.map((item) => normalizeOrder(item as OrderRecord)),
    attempts: [],
    audit: [],
  };
}

async function writeDb(db: PaymentDb): Promise<void> {
  await writeJsonAtomic(paymentOrdersPath(), db);
}

function locked<T>(work: () => Promise<T>): Promise<T> {
  return enqueue(() => withLockedUpdate(paymentOrdersPath(), work));
}

export function createOrderId(): string {
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
  return `TG-${stamp}-${randomBytes(3).toString('hex').toUpperCase()}`;
}

export function createAttemptId(): string {
  return `PA-${randomBytes(8).toString('hex')}`;
}

export async function saveOrder(order: OrderRecord): Promise<OrderRecord> {
  return locked(async () => {
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
  return locked(async () => {
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
  return locked(async () => {
    const db = await readDb();
    const index = db.attempts.findIndex((item) => item.id === attempt.id);
    if (index >= 0) db.attempts[index] = attempt;
    else db.attempts.push(attempt);
    await writeDb(db);
    return attempt;
  });
}

export async function updateAttempt(id: string, patch: Partial<PaymentAttempt>): Promise<PaymentAttempt | null> {
  return locked(async () => {
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
  await locked(async () => {
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
