import { readFileSync } from 'fs';
import { randomBytes } from 'crypto';
import { DataFileError, readJsonFile, withLockedUpdate, writeJsonAtomic } from '@/lib/persistence/locked-json';
import {
  formatPlatformLabels,
  parsePlatformIds,
  uniquePlatforms,
  type DownloadPlatformId,
} from '@/data/downloads';
import { downloadsDataPath } from '@/lib/downloads/config';
import { legacySaleOpen } from '@/lib/downloads/sale';
import { resolveStoredFileAbsolute, storedFileExists } from '@/lib/downloads/storage';
import type {
  DownloadEntitlement,
  DownloadsDb,
  PublicDownloadPackage,
  StoredDownloadPackage,
} from '@/lib/downloads/types';

let queue: Promise<unknown> = Promise.resolve();

function enqueue<T>(work: () => Promise<T>): Promise<T> {
  const run = queue.then(work, work);
  queue = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

function emptyDb(): DownloadsDb {
  return { packages: [], entitlements: [], audit: [] };
}

function resolvePlatforms(raw: Partial<StoredDownloadPackage>): DownloadPlatformId[] {
  const fromArray = Array.isArray(raw.platforms) ? parsePlatformIds(raw.platforms) : [];
  if (fromArray.length > 0) return fromArray;
  return parsePlatformIds(raw.platform);
}

function normalizePackage(raw: StoredDownloadPackage): StoredDownloadPackage {
  const platforms = uniquePlatforms(resolvePlatforms(raw));
  return {
    ...raw,
    platforms,
    platform: formatPlatformLabels(platforms) || raw.platform || 'Universal',
    currency: raw.currency ?? 'USD',
    mimeType: raw.mimeType ?? 'application/octet-stream',
    published: raw.published ?? raw.status === 'published',
    status: raw.published === false ? 'unpublished' : raw.status ?? 'published',
    saleOpen: legacySaleOpen(raw.saleOpen),
  };
}

function normalizeEntitlement(raw: DownloadEntitlement): DownloadEntitlement {
  return {
    ...raw,
    status: raw.status ?? 'active',
  };
}

function normalizeDb(raw: Partial<DownloadsDb>): DownloadsDb {
  return {
    packages: Array.isArray(raw.packages) ? raw.packages.map(normalizePackage) : [],
    entitlements: Array.isArray(raw.entitlements) ? raw.entitlements.map(normalizeEntitlement) : [],
    audit: Array.isArray(raw.audit) ? raw.audit : [],
  };
}

function parseDownloadsDb(value: unknown): DownloadsDb {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new DataFileError('invalid', 'Download store schema is invalid');
  }
  const record = value as Partial<DownloadsDb>;
  if (!Array.isArray(record.packages)) {
    throw new DataFileError('invalid', 'Download store schema is invalid');
  }
  return normalizeDb(record);
}

async function readDb(): Promise<DownloadsDb> {
  const loaded = await readJsonFile(downloadsDataPath());
  if (loaded.missing) return emptyDb();
  return parseDownloadsDb(loaded.value);
}

function readDbSync(): DownloadsDb {
  const file = downloadsDataPath();
  let raw: string;
  try {
    raw = readFileSync(file, 'utf8');
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error ? (error as { code?: string }).code : '';
    if (code === 'ENOENT') return emptyDb();
    throw new DataFileError('unreadable', 'Download store cannot be read');
  }
  if (!raw.trim()) throw new DataFileError('invalid', 'Download store is empty');
  try {
    return parseDownloadsDb(JSON.parse(raw) as unknown);
  } catch (error) {
    if (error instanceof DataFileError) throw error;
    throw new DataFileError('invalid', 'Download store is not valid JSON');
  }
}

async function writeDb(db: DownloadsDb): Promise<void> {
  await writeJsonAtomic(downloadsDataPath(), db);
}

function locked<T>(work: () => Promise<T>): Promise<T> {
  return enqueue(() => withLockedUpdate(downloadsDataPath(), work));
}

export async function appendDownloadAudit(entry: {
  event: string;
  productId?: string;
  fileName?: string;
  fileSize?: number;
  admin?: string;
}): Promise<void> {
  return locked(async () => {
    const db = await readDb();
    db.audit.push({
      id: `AUD-${randomBytes(6).toString('hex')}`,
      ...entry,
      createdAt: new Date().toISOString(),
    });
    if (db.audit.length > 500) db.audit = db.audit.slice(-500);
    await writeDb(db);
  });
}

export async function listStoredPackages(): Promise<StoredDownloadPackage[]> {
  const db = await readDb();
  return db.packages.slice().sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
}

/** Sync read for commerce quote path (catalog single source). */
export function getDownloadPackageSync(productId: string): StoredDownloadPackage | null {
  const db = readDbSync();
  return db.packages.find((pkg) => pkg.productId === productId || pkg.id === productId) ?? null;
}

export function listDownloadPackagesSync(): StoredDownloadPackage[] {
  return readDbSync().packages;
}

export async function getStoredPackageByProductId(
  productId: string
): Promise<StoredDownloadPackage | null> {
  const db = await readDb();
  return db.packages.find((pkg) => pkg.productId === productId || pkg.id === productId) ?? null;
}

export async function absoluteStoragePath(pkg: StoredDownloadPackage): Promise<string | null> {
  const absolute = resolveStoredFileAbsolute(pkg.storageRelativePath || pkg.storedFileName);
  if (!absolute) return null;
  const ok = await storedFileExists(pkg.storageRelativePath || pkg.storedFileName);
  return ok ? absolute : null;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function toPublicPackage(
  pkg: StoredDownloadPackage,
  fileAvailable: boolean
): PublicDownloadPackage {
  const price = pkg.priceUsd;
  const platforms = uniquePlatforms(resolvePlatforms(pkg));
  return {
    id: pkg.id,
    productId: pkg.productId,
    name: pkg.name,
    description: pkg.description,
    platforms,
    platform: formatPlatformLabels(platforms) || pkg.platform,
    version: pkg.version,
    architecture: pkg.architecture,
    fileType: pkg.fileType,
    fileSize: pkg.fileSize,
    uploadedAt: pkg.uploadedAt,
    priceUsd: price,
    currency: pkg.currency || 'USD',
    checksumSha256: pkg.checksumSha256,
    fileAvailable,
    saleOpen: pkg.saleOpen,
    purchasable: fileAvailable && pkg.saleOpen === true && price != null && price > 0,
    free: fileAvailable && price === 0,
  };
}

export async function listPublicPackages(pageSize = 20): Promise<PublicDownloadPackage[]> {
  const packages = (await listStoredPackages()).filter((pkg) => pkg.published !== false);
  const result: PublicDownloadPackage[] = [];
  for (const pkg of packages.slice(0, pageSize)) {
    const available = await storedFileExists(pkg.storageRelativePath || pkg.storedFileName);
    result.push(toPublicPackage(pkg, available));
  }
  return result;
}

export async function saveUploadedPackage(
  pkg: StoredDownloadPackage,
  adminEmail: string,
  event: 'upload' | 'update' = 'upload'
): Promise<StoredDownloadPackage> {
  return locked(async () => {
    const db = await readDb();
    const index = db.packages.findIndex((item) => item.productId === pkg.productId);
    if (index >= 0) db.packages[index] = pkg;
    else db.packages.push(pkg);
    db.audit.push({
      id: `AUD-${randomBytes(6).toString('hex')}`,
      event,
      productId: pkg.productId,
      fileName: pkg.originalFileName,
      fileSize: pkg.fileSizeBytes,
      admin: adminEmail,
      createdAt: new Date().toISOString(),
    });
    if (db.audit.length > 500) db.audit = db.audit.slice(-500);
    await writeDb(db);
    return pkg;
  });
}

/** Idempotent. Serialized with other store writes. Does not touch entitlements. */
export async function updatePackageSaleOpen(
  productId: string,
  saleOpen: boolean
): Promise<StoredDownloadPackage | null> {
  const id = productId.trim();
  if (!id || id.includes('..') || id.includes('/') || id.includes('\\')) return null;
  return locked(async () => {
    const db = await readDb();
    const index = db.packages.findIndex((item) => item.productId === id || item.id === id);
    if (index < 0) return null;
    const current = db.packages[index];
    if (current.saleOpen === saleOpen) return current;
    const next: StoredDownloadPackage = { ...current, saleOpen };
    db.packages[index] = next;
    db.audit.push({
      id: `AUD-${randomBytes(6).toString('hex')}`,
      event: saleOpen ? 'sale_opened' : 'sale_closed',
      productId: current.productId,
      admin: 'download-admin',
      createdAt: new Date().toISOString(),
    });
    if (db.audit.length > 500) db.audit = db.audit.slice(-500);
    await writeDb(db);
    return next;
  });
}

export async function grantDownloadEntitlement(input: {
  orderId: string;
  productId: string;
  paymentId: string | null;
  statusToken: string;
  customerEmail: string;
  expiresAt?: string | null;
}): Promise<DownloadEntitlement | null> {
  const pkg = await getStoredPackageByProductId(input.productId);
  if (!pkg) return null;
  if (pkg.productId !== input.productId) return null;

  return locked(async () => {
    const db = await readDb();
    const existing = db.entitlements.find(
      (item) => item.orderId === input.orderId && item.productId === input.productId && item.status === 'active'
    );
    if (existing) return existing;
    const entitlement: DownloadEntitlement = {
      id: `DE-${randomBytes(8).toString('hex')}`,
      orderId: input.orderId,
      productId: input.productId,
      paymentId: input.paymentId,
      paymentStatus: 'paid',
      downloadGranted: true,
      status: 'active',
      statusToken: input.statusToken,
      customerEmail: input.customerEmail,
      grantedAt: new Date().toISOString(),
      expiresAt: input.expiresAt ?? null,
    };
    db.entitlements.push(entitlement);
    await writeDb(db);
    return entitlement;
  });
}

/** Revoke all active entitlements for an order (refund / chargeback / cancel-after-pay). */
export async function revokeDownloadEntitlementsForOrder(orderId: string): Promise<number> {
  const id = orderId.trim();
  if (!id) return 0;
  return locked(async () => {
    const db = await readDb();
    let count = 0;
    db.entitlements = db.entitlements.map((item) => {
      if (item.orderId !== id || item.status === 'revoked') return item;
      count += 1;
      return { ...item, status: 'revoked' as const, downloadGranted: true };
    });
    if (count > 0) {
      db.audit.push({
        id: `AUD-${randomBytes(6).toString('hex')}`,
        event: 'entitlement_revoked',
        productId: undefined,
        createdAt: new Date().toISOString(),
      });
      if (db.audit.length > 500) db.audit = db.audit.slice(-500);
      await writeDb(db);
    }
    return count;
  });
}

export async function findValidEntitlement(input: {
  productId: string;
  statusTokens: string[];
}): Promise<DownloadEntitlement | null> {
  if (!input.statusTokens.length) return null;
  const db = await readDb();
  const now = Date.now();
  const match = db.entitlements.find((item) => {
    if (item.productId !== input.productId) return false;
    if (item.status !== 'active') return false;
    if (!item.downloadGranted || item.paymentStatus !== 'paid') return false;
    if (!input.statusTokens.includes(item.statusToken)) return false;
    if (item.expiresAt && Date.parse(item.expiresAt) < now) return false;
    return true;
  });
  return match ?? null;
}
