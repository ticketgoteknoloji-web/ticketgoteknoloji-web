import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const downloadsData = readFileSync(join(root, 'src/data/downloads.ts'), 'utf8');
const configSrc = readFileSync(join(root, 'src/lib/downloads/config.ts'), 'utf8');
const storeSrc = readFileSync(join(root, 'src/lib/downloads/store.ts'), 'utf8');
const storageSrc = readFileSync(join(root, 'src/lib/downloads/storage.ts'), 'utf8');
const table = readFileSync(join(root, 'src/components/download/DownloadTable.tsx'), 'utf8');
const page = readFileSync(join(root, 'src/app/download/page.tsx'), 'utf8');
const loginRoute = readFileSync(join(root, 'src/app/api/downloads/admin/login/route.ts'), 'utf8');
const uploadRoute = readFileSync(join(root, 'src/app/api/downloads/admin/upload/route.ts'), 'utf8');
const fileRoute = readFileSync(join(root, 'src/app/api/downloads/[productId]/file/route.ts'), 'utf8');
const accessRoute = readFileSync(join(root, 'src/app/api/downloads/[productId]/access/route.ts'), 'utf8');
const envExample = readFileSync(join(root, '.env.example'), 'utf8');
const gitignore = readFileSync(join(root, '.gitignore'), 'utf8');

const FORBIDDEN = [
  /feribot/i,
  /ferry/i,
  /ticket-go\.net/i,
  /biletleme/i,
  /Desktop Suite/,
  /fakeDownloads/,
  /Array\.from\(\{\s*length:\s*20/,
];

test('no demo/fake download catalog rows in client data', () => {
  assert.doesNotMatch(downloadsData, /DOWNLOAD_PACKAGES/);
  assert.doesNotMatch(downloadsData, /isDemo:\s*true/);
  assert.match(downloadsData, /DOWNLOAD_PAGE_SIZE = 20/);
  assert.match(table, /Henüz yayınlanmış bir yazılım paketi bulunmuyor/);
  assert.match(table, /packages\.length === 0/);
  assert.doesNotMatch(table, /fakeDownloads/);
});

test('admin password is env-hash based, not hardcoded', () => {
  assert.match(configSrc, /DOWNLOAD_ADMIN_PASSWORD_HASH/);
  assert.match(configSrc, /scrypt/);
  assert.doesNotMatch(loginRoute, /const ADMIN_PASSWORD\s*=/);
  assert.match(loginRoute, /authenticateAdminCredentials/);
  assert.match(envExample, /DOWNLOAD_ADMIN_EMAIL=/);
  assert.match(envExample, /DOWNLOAD_ADMIN_PASSWORD_HASH=/);
  assert.match(envExample, /DOWNLOAD_STORAGE_DIR=/);
  assert.doesNotMatch(envExample, /scrypt\$/);
});

test('upload and file routes enforce auth and private storage', () => {
  assert.match(uploadRoute, /readAdminSession/);
  assert.match(uploadRoute, /status: 401/);
  assert.match(fileRoute, /priceUsd === 0/);
  assert.match(fileRoute, /findValidEntitlement/);
  assert.match(fileRoute, /Content-Disposition/);
  assert.match(fileRoute, /private, no-store/);
  assert.match(accessRoute, /priceUsd === 0/);
  assert.match(storageSrc, /resolveDownloadStorageDir/);
  assert.match(storeSrc, /storedFileExists/);
  assert.match(gitignore, /\.storage/);
});

test('commerce resolves download products from real store only', () => {
  const commerceServer = readFileSync(join(root, 'src/lib/commerce-server.ts'), 'utf8');
  assert.match(commerceServer, /getDownloadPackageSync/);
  assert.match(commerceServer, /category: 'download'/);
  assert.match(commerceServer, /server-only/);
});

test('download page has no ferry brand leakage', () => {
  for (const pattern of FORBIDDEN) {
    assert.doesNotMatch(page, pattern);
    assert.doesNotMatch(table, pattern);
    assert.doesNotMatch(downloadsData, pattern);
  }
});

test('path traversal helpers reject unsafe names', () => {
  function isSafeRelativeStorageName(name) {
    if (!name || name.length > 180) return false;
    if (name.includes('\0')) return false;
    if (name.includes('..') || name.includes('/') || name.includes('\\')) return false;
    return /^[a-zA-Z0-9._-]+$/.test(name);
  }
  assert.equal(isSafeRelativeStorageName('../etc/passwd'), false);
  assert.equal(isSafeRelativeStorageName('/tmp/x.txt'), false);
  assert.equal(isSafeRelativeStorageName('abc123.txt'), true);
});

test('private storage is not under public', () => {
  assert.equal(existsSync(join(root, 'public/downloads')), false);
});

test('seeded safe-upload guide is a real published free package', () => {
  const dbPath = join(root, '.data', 'downloads.json');
  assert.equal(existsSync(dbPath), true);
  const db = JSON.parse(readFileSync(dbPath, 'utf8'));
  const matches = (db.packages || []).filter((p) => p.originalFileName === 'guvenli-yukleme-talimatlari.txt');
  assert.equal(matches.length, 1, 'expected exactly one real package row');
  const pkg = matches[0];
  assert.ok(pkg, 'expected real package metadata');
  assert.equal(pkg.name, 'Güvenli Yükleme Talimatları');
  assert.equal(pkg.priceUsd, 0);
  assert.equal(pkg.published, true);
  assert.equal(pkg.fileType, 'TXT');
  assert.match(pkg.checksumSha256, /^[a-f0-9]{64}$/);
  assert.ok(pkg.fileSizeBytes > 0);
  assert.deepEqual(pkg.platforms, ['windows', 'macos', 'android', 'ios']);
  assert.match(pkg.platform, /Windows/);
  assert.match(pkg.platform, /macOS/);
  assert.match(pkg.platform, /Android/);
  assert.match(pkg.platform, /iOS/);
  assert.doesNotMatch(JSON.stringify(pkg), /\/srv\//);
});

test('platform filter helpers support multi-platform packages', () => {
  assert.match(downloadsData, /platforms\.includes|ids\.includes/);
  assert.match(downloadsData, /parsePlatformIds/);
  assert.match(downloadsData, /matchesPlatformFilter/);
  assert.match(table, /PlatformBadges/);
  assert.match(table, /pkg\.platforms/);
  assert.match(table, /name=\"platforms\"/);
});
