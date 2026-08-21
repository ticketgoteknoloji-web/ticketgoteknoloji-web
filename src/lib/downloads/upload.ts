import { randomBytes } from 'crypto';
import {
  formatPlatformLabels,
  parsePlatformIds,
  uniquePlatforms,
  type DownloadPlatformId,
} from '@/data/downloads';
import {
  sanitizeOriginalFileName,
  sha256Buffer,
  validateUploadFile,
} from '@/lib/downloads/config';
import { deleteStoredFileSafe, DownloadStorageError, writeDownloadFile } from '@/lib/downloads/storage';
import { formatBytes, getStoredPackageByProductId, saveUploadedPackage } from '@/lib/downloads/store';
import type { StoredDownloadPackage } from '@/lib/downloads/types';

export async function persistAdminUpload(input: {
  adminEmail: string;
  name: string;
  description: string;
  /** Preferred: multi-platform ids. */
  platforms?: string[] | string;
  /** Legacy single label — still accepted and parsed. */
  platform?: string;
  version: string;
  architecture: string;
  priceUsd: number | null;
  currency: string;
  published: boolean;
  /** When set, replaces an existing product after new file is safely written. */
  replaceProductId?: string | null;
  file: File;
}): Promise<{ ok: true; package: StoredDownloadPackage } | { ok: false; error: string }> {
  const name = input.name.trim();
  const description = input.description.trim();
  const version = input.version.trim();
  const architecture = (input.architecture.trim() || 'Universal').slice(0, 40);
  const currency = (input.currency.trim() || 'USD').toUpperCase().slice(0, 8);

  const platforms: DownloadPlatformId[] = uniquePlatforms(
    parsePlatformIds(input.platforms ?? input.platform ?? '')
  );

  if (!name || name.length > 120) return { ok: false, error: 'Geçerli bir yazılım adı girin.' };
  if (!description || description.length > 500) return { ok: false, error: 'Geçerli bir açıklama girin.' };
  if (platforms.length === 0) return { ok: false, error: 'En az bir platform seçin.' };
  if (!version || version.length > 40) return { ok: false, error: 'Geçerli bir sürüm girin.' };
  if (input.priceUsd != null && (!Number.isFinite(input.priceUsd) || input.priceUsd < 0 || input.priceUsd > 1_000_000)) {
    return { ok: false, error: 'Geçerli bir fiyat girin.' };
  }

  const originalFileName = sanitizeOriginalFileName(input.file.name);
  if (originalFileName.includes('..') || originalFileName.includes('/') || originalFileName.includes('\\')) {
    return { ok: false, error: 'Geçersiz dosya adı.' };
  }

  const validated = validateUploadFile({
    originalName: originalFileName,
    mimeType: input.file.type || 'application/octet-stream',
    sizeBytes: input.file.size,
  });
  if (!validated.ok) return validated;

  const buffer = Buffer.from(await input.file.arrayBuffer());
  if (buffer.length !== input.file.size) {
    return { ok: false, error: 'Dosya okunamadı.' };
  }

  let storedFileName: string;
  try {
    ({ storedFileName } = await writeDownloadFile({ ext: validated.ext, buffer }));
  } catch (error) {
    if (error instanceof DownloadStorageError) {
      return { ok: false, error: error.message };
    }
    return { ok: false, error: 'Dosya kaydedilemedi.' };
  }

  const replaceId = input.replaceProductId?.trim() || null;
  const existing = replaceId ? await getStoredPackageByProductId(replaceId) : null;
  const previousStored = existing?.storedFileName ?? null;

  const now = new Date().toISOString();
  const id = existing?.id ?? `dl-${randomBytes(6).toString('hex')}`;
  const productId = existing?.productId ?? `download-${id}`;
  const platformLabel = formatPlatformLabels(platforms);
  const pkg: StoredDownloadPackage = {
    id,
    productId,
    name,
    description,
    platforms,
    platform: platformLabel,
    version,
    architecture,
    fileType: validated.fileTypeLabel,
    mimeType: (input.file.type || 'application/octet-stream').split(';')[0]?.trim() || 'application/octet-stream',
    fileSize: formatBytes(buffer.length),
    fileSizeBytes: buffer.length,
    priceUsd: input.priceUsd,
    currency,
    storedFileName,
    originalFileName,
    storageRelativePath: storedFileName,
    checksumSha256: sha256Buffer(buffer),
    uploadedAt: now,
    uploadedBy: input.adminEmail,
    published: input.published,
    status: input.published ? 'published' : 'unpublished',
  };

  const saved = await saveUploadedPackage(pkg, input.adminEmail, existing ? 'update' : 'upload');

  // Cleanup previous file only after new metadata is committed.
  if (previousStored && previousStored !== storedFileName) {
    await deleteStoredFileSafe(previousStored);
  }

  return { ok: true, package: saved };
}
