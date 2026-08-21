#!/usr/bin/env node
/**
 * Seed the first real download package: Güvenli Yükleme Talimatları (.txt)
 * Uses the same metadata shape as admin upload (StoredDownloadPackage).
 * Does NOT invent fake products — writes one real file + one real record.
 *
 * Usage: node scripts/seed-guvenli-yukleme.mjs
 */
import { createHash, randomBytes } from 'node:crypto';
import { mkdir, readFile, rename, writeFile, access, constants } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONTENT = `GÜVENLİ YÜKLEME TALİMATLARI

1. Yalnızca TicketGo Teknoloji A.Ş. tarafından yetkilendirilmiş yazılım paketlerini yükleyin.

2. Dosya yüklemeden önce dosya adını, sürümünü, platformunu ve dosya türünü doğrulayın.

3. Kaynağı bilinmeyen, değiştirilmiş veya güvenilirliği doğrulanmamış dosyaları sisteme yüklemeyin.

4. Yükleme sırasında oluşturulan SHA-256 doğrulama bilgisini kontrol edin ve gerektiğinde paket bütünlüğünü doğrulamak için kullanın.

5. Yönetici kullanıcı adı, parola, oturum bilgisi, API anahtarı veya diğer gizli bilgileri yazılım paketlerinin içine eklemeyin.

6. Yazılım paketlerini yalnızca yetkili yönetici hesabı üzerinden yükleyin.

7. Yükleme tamamlanmadan veya sistem başarılı kayıt oluşturduğunu doğrulamadan işlemi kapatmayın.

8. Yanlış veya güvenilirliği doğrulanamayan bir dosya yüklendiğinde paketi yayınlamayın.

9. İndirilebilir dosyaların private storage alanında tutulduğunu ve doğrudan public URL üzerinden yayınlanmadığını doğrulayın.

10. Production ortamına alınacak yazılım paketlerini yayınlamadan önce güvenlik ve sürüm kontrollerini tamamlayın.

TicketGo Teknoloji A.Ş.
ticketgoteknoloji.com
`;

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function resolveStorageDir() {
  const fromEnv = process.env.DOWNLOAD_STORAGE_DIR?.trim();
  if (fromEnv) return path.resolve(fromEnv);
  return path.join(root, '.storage', 'downloads');
}

async function ensureWritable(dir) {
  await mkdir(dir, { recursive: true });
  await access(dir, constants.R_OK | constants.W_OK);
  const probe = path.join(dir, `.write-probe-${process.pid}`);
  await writeFile(probe, 'ok');
  await (await import('node:fs/promises')).unlink(probe);
}

async function main() {
  const storageDir = resolveStorageDir();
  const dataPath = path.join(root, '.data', 'downloads.json');

  await ensureWritable(storageDir);
  await mkdir(path.dirname(dataPath), { recursive: true });

  const buffer = Buffer.from(CONTENT, 'utf8');
  const sha256 = createHash('sha256').update(buffer).digest('hex');
  const storedFileName = `${randomBytes(16).toString('hex')}.txt`;
  if (storedFileName.includes('..') || storedFileName.includes('/')) {
    throw new Error('Invalid stored filename');
  }

  const absolute = path.join(storageDir, storedFileName);
  await writeFile(absolute, buffer);

  const id = `dl-${randomBytes(6).toString('hex')}`;
  const productId = `download-${id}`;
  const now = new Date().toISOString();

  const record = {
    id,
    productId,
    name: 'Güvenli Yükleme Talimatları',
    description: 'TicketGo Teknoloji A.Ş. yazılım paketleri için güvenli yükleme talimatları.',
    platforms: ['windows', 'macos', 'android', 'ios'],
    platform: 'Windows · macOS · Android · iOS',
    version: '1.0.0',
    architecture: 'Universal',
    fileType: 'TXT',
    mimeType: 'text/plain',
    fileSize: formatBytes(buffer.length),
    fileSizeBytes: buffer.length,
    priceUsd: 0,
    currency: 'USD',
    storedFileName,
    originalFileName: 'guvenli-yukleme-talimatlari.txt',
    storageRelativePath: storedFileName,
    checksumSha256: sha256,
    uploadedAt: now,
    uploadedBy: 'system-seed',
    published: true,
    status: 'published',
  };

  let db = { packages: [], entitlements: [], audit: [] };
  try {
    db = JSON.parse(await readFile(dataPath, 'utf8'));
    if (!Array.isArray(db.packages)) db.packages = [];
    if (!Array.isArray(db.entitlements)) db.entitlements = [];
    if (!Array.isArray(db.audit)) db.audit = [];
  } catch {
    // new db
  }

  // Remove any prior seed of the same logical doc (by originalFileName + name) to avoid duplicates
  db.packages = db.packages.filter(
    (p) =>
      !(
        p.originalFileName === 'guvenli-yukleme-talimatlari.txt' &&
        p.name === 'Güvenli Yükleme Talimatları'
      )
  );

  db.packages.push(record);
  db.audit.push({
    id: `AUD-${randomBytes(6).toString('hex')}`,
    event: 'upload',
    productId,
    fileName: record.originalFileName,
    fileSize: record.fileSizeBytes,
    admin: 'system-seed',
    createdAt: now,
  });

  const tmp = `${dataPath}.${randomBytes(4).toString('hex')}.tmp`;
  await writeFile(tmp, JSON.stringify(db, null, 2), 'utf8');
  await rename(tmp, dataPath);

  // Report without absolute storage path
  console.log(
    JSON.stringify(
      {
        ok: true,
        productId,
        id,
        originalFileName: record.originalFileName,
        storedFileName,
        fileSizeBytes: record.fileSizeBytes,
        fileSize: record.fileSize,
        sha256,
        published: true,
        priceUsd: 0,
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
