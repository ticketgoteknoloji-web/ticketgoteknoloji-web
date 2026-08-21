import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'crypto';
import path from 'path';

/** Allowed upload extensions (lowercase, no leading dot). Supports tar.gz via special handling. */
export const DOWNLOAD_ALLOWED_EXTENSIONS = new Set([
  'txt',
  'zip',
  'dmg',
  'pkg',
  'exe',
  'msi',
  'apk',
  'gz', // only when original ends with .tar.gz
]);

/** Extension → accepted MIME types (best-effort; browsers vary). */
export const DOWNLOAD_ALLOWED_MIME: Record<string, string[]> = {
  txt: ['text/plain', 'application/octet-stream'],
  zip: ['application/zip', 'application/x-zip-compressed', 'application/octet-stream'],
  dmg: ['application/octet-stream', 'application/x-apple-diskimage'],
  pkg: ['application/octet-stream', 'application/x-newton-compatible-pkg'],
  exe: ['application/octet-stream', 'application/vnd.microsoft.portable-executable', 'application/x-msdownload'],
  msi: ['application/octet-stream', 'application/x-msi', 'application/x-msdownload'],
  apk: ['application/vnd.android.package-archive', 'application/octet-stream', 'application/zip'],
  gz: ['application/gzip', 'application/x-gzip', 'application/x-tar', 'application/octet-stream'],
};

export const DOWNLOAD_PAGE_SIZE = 20;

export const DOWNLOAD_ADMIN_COOKIE = 'tg_dl_admin';
export const DOWNLOAD_ACCESS_COOKIE = 'tg_dl_access';

export function downloadsDataPath(): string {
  return path.join(process.cwd(), '.data', 'downloads.json');
}

/** @deprecated Use resolveDownloadStorageDir from storage.ts */
export function downloadsStorageRoot(): string {
  const fromEnv = process.env.DOWNLOAD_STORAGE_DIR?.trim();
  if (fromEnv) return path.resolve(fromEnv);
  return path.join(process.cwd(), '.storage', 'downloads');
}

export function maxDownloadBytes(): number {
  const mb = Number(process.env.DOWNLOAD_MAX_FILE_SIZE_MB ?? '2048');
  const safe = Number.isFinite(mb) && mb > 0 ? mb : 2048;
  return Math.min(safe, 8192) * 1024 * 1024;
}

export function isSafeRelativeStorageName(name: string): boolean {
  if (!name || name.length > 180) return false;
  if (name.includes('\0')) return false;
  if (/[\u0000-\u001f]/.test(name)) return false;
  if (name.includes('..') || name.includes('/') || name.includes('\\')) return false;
  if (path.isAbsolute(name)) return false;
  return /^[a-zA-Z0-9._-]+$/.test(name);
}

export function sanitizeOriginalFileName(name: string): string {
  const base = path.basename(name).replace(/[^\w.\-()+ ]+/g, '_').trim();
  return base.slice(0, 120) || 'file';
}

export function extensionOf(fileName: string): string | null {
  const base = path.basename(fileName).toLowerCase();
  if (base.endsWith('.tar.gz')) return 'tar.gz';
  const parts = base.split('.');
  if (parts.length < 2) return null;
  if (parts.some((p) => !p)) return null;
  return parts[parts.length - 1] ?? null;
}

export function validateUploadFile(input: {
  originalName: string;
  mimeType: string;
  sizeBytes: number;
}): { ok: true; ext: string; fileTypeLabel: string } | { ok: false; error: string } {
  if (input.sizeBytes <= 0) return { ok: false, error: 'Dosya boş olamaz.' };
  if (input.sizeBytes > maxDownloadBytes()) {
    return { ok: false, error: 'Dosya izin verilen maksimum boyutu aşıyor.' };
  }
  const ext = extensionOf(input.originalName);
  if (!ext) return { ok: false, error: 'Bu dosya türüne izin verilmiyor.' };

  if (ext === 'tar.gz') {
    const mime = (input.mimeType || 'application/octet-stream').toLowerCase().split(';')[0]?.trim() ?? '';
    const allowed = DOWNLOAD_ALLOWED_MIME.gz;
    if (mime && !allowed.includes(mime)) {
      return { ok: false, error: 'Dosya içeriği uzantı ile uyuşmuyor.' };
    }
    return { ok: true, ext: 'tar.gz', fileTypeLabel: 'TAR.GZ' };
  }

  if (!DOWNLOAD_ALLOWED_EXTENSIONS.has(ext) || ext === 'gz') {
    return { ok: false, error: 'Bu dosya türüne izin verilmiyor.' };
  }
  const allowedMime = DOWNLOAD_ALLOWED_MIME[ext] ?? [];
  const mime = (input.mimeType || 'application/octet-stream').toLowerCase().split(';')[0]?.trim() ?? '';
  if (allowedMime.length && mime && !allowedMime.includes(mime)) {
    return { ok: false, error: 'Dosya içeriği uzantı ile uyuşmuyor.' };
  }
  return { ok: true, ext, fileTypeLabel: ext.toUpperCase() };
}

export function createStoredFileName(ext: string): string {
  const id = randomBytes(16).toString('hex');
  // tar.gz must keep compound suffix
  if (ext === 'tar.gz') return `${id}.tar.gz`;
  return `${id}.${ext}`;
}

export function sha256Buffer(buf: Buffer): string {
  return createHash('sha256').update(buf).digest('hex');
}

/** scrypt$salt$hexhash — admin code never stored in plaintext. */
export function hashDownloadAdminCode(code: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(code, salt, 64).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

export function verifyDownloadAdminCode(code: string, stored: string): boolean {
  if (!code || !stored) return false;
  const parts = stored.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const [, salt, expectedHex] = parts;
  if (!salt || !expectedHex) return false;
  try {
    const actual = scryptSync(code, salt, 64);
    const expected = Buffer.from(expectedHex, 'hex');
    if (actual.length !== expected.length) return false;
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

export function expectedAdminCodeHash(): string {
  return (process.env.DOWNLOAD_ADMIN_CODE_HASH ?? '').trim();
}

export const DOWNLOAD_ADMIN_CODE_MAX_LENGTH = 256;

export function downloadSessionSecretCandidates(): string[] {
  return [
    process.env.DOWNLOAD_ADMIN_SESSION_SECRET?.trim(),
    process.env.DOWNLOAD_SESSION_SECRET?.trim(),
    process.env.PAYMENT_SIGNING_SECRET?.trim(),
  ].filter((v): v is string => Boolean(v));
}
