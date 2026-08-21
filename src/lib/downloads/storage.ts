import 'server-only';

import { createReadStream, existsSync } from 'fs';
import { access, constants, mkdir, unlink, writeFile } from 'fs/promises';
import path from 'path';
import { Readable } from 'stream';
import { createStoredFileName, isSafeRelativeStorageName } from '@/lib/downloads/config';
import { paymentEnv } from '@/lib/payments/config';

const DEFAULT_PROD_DIR = '/srv/ticketgoteknoloji/downloads';
const DEFAULT_DEV_DIR = path.join(process.cwd(), '.storage', 'downloads');

export class DownloadStorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DownloadStorageError';
  }
}

/**
 * Resolve private download storage directory.
 * Prefer DOWNLOAD_STORAGE_DIR.
 * Production default: /srv/ticketgoteknoloji/downloads (when available)
 * Development fallback: <project-root>/.storage/downloads
 * Never use public/.
 */
export function resolveDownloadStorageDir(): string {
  const fromEnv = process.env.DOWNLOAD_STORAGE_DIR?.trim();
  if (fromEnv) return path.resolve(fromEnv);
  if (paymentEnv() === 'production') {
    if (existsSync('/srv/ticketgoteknoloji') || existsSync(DEFAULT_PROD_DIR)) {
      return DEFAULT_PROD_DIR;
    }
  }
  return DEFAULT_DEV_DIR;
}

export async function ensureDownloadStorageWritable(): Promise<string> {
  const root = resolveDownloadStorageDir();
  try {
    await mkdir(root, { recursive: true });
  } catch (error) {
    const code = (error as NodeJS.ErrnoException)?.code;
    if (code === 'EACCES' || code === 'EPERM') {
      throw new DownloadStorageError('Download storage dizinine yazma yetkisi yok.');
    }
    throw new DownloadStorageError(`Download storage dizini oluşturulamadı: ${root}`);
  }

  try {
    await access(root, constants.R_OK | constants.W_OK);
  } catch {
    throw new DownloadStorageError('Download storage dizinine yazma yetkisi yok.');
  }

  const probe = path.join(root, `.write-probe-${process.pid}-${Date.now()}`);
  try {
    await writeFile(probe, Buffer.from('ok'));
    await unlink(probe);
  } catch {
    throw new DownloadStorageError('Download storage dizinine yazma yetkisi yok.');
  }

  return root;
}

export function resolveStoredFileAbsolute(storedFileName: string): string | null {
  if (!isSafeRelativeStorageName(storedFileName)) return null;
  const root = path.resolve(resolveDownloadStorageDir());
  const full = path.resolve(path.join(root, storedFileName));
  if (!full.startsWith(root + path.sep) && full !== root) return null;
  return full;
}

export async function storedFileExists(storedFileName: string): Promise<boolean> {
  const absolute = resolveStoredFileAbsolute(storedFileName);
  if (!absolute) return false;
  try {
    await access(absolute, constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

export async function writeDownloadFile(input: {
  ext: string;
  buffer: Buffer;
}): Promise<{ storedFileName: string }> {
  await ensureDownloadStorageWritable();
  const storedFileName = createStoredFileName(input.ext);
  const absolutePath = resolveStoredFileAbsolute(storedFileName);
  if (!absolutePath) {
    throw new DownloadStorageError('Geçersiz dosya adı üretildi.');
  }
  try {
    await writeFile(absolutePath, input.buffer);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException)?.code;
    if (code === 'EACCES' || code === 'EPERM') {
      throw new DownloadStorageError('Download storage dizinine yazma yetkisi yok.');
    }
    throw error;
  }
  return { storedFileName };
}

export async function deleteStoredFileSafe(storedFileName: string): Promise<void> {
  const absolute = resolveStoredFileAbsolute(storedFileName);
  if (!absolute) return;
  try {
    await unlink(absolute);
  } catch {
    // ignore missing files during cleanup
  }
}

export async function openStoredFileStream(
  storedFileName: string
): Promise<ReadableStream | null> {
  const absolute = resolveStoredFileAbsolute(storedFileName);
  if (!absolute) return null;
  try {
    await access(absolute, constants.R_OK);
  } catch {
    return null;
  }
  const nodeStream = createReadStream(absolute);
  return Readable.toWeb(nodeStream) as unknown as ReadableStream;
}
