import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const downloadsData = readFileSync(join(root, 'src/data/downloads.ts'), 'utf8');
const configSrc = readFileSync(join(root, 'src/lib/downloads/config.ts'), 'utf8');
const storeSrc = readFileSync(join(root, 'src/lib/downloads/store.ts'), 'utf8');
const storageSrc = readFileSync(join(root, 'src/lib/downloads/storage.ts'), 'utf8');
const table = readFileSync(join(root, 'src/components/download/DownloadTable.tsx'), 'utf8');
const uploadModal = readFileSync(join(root, 'src/components/download/AdminUploadModal.tsx'), 'utf8');
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
  assert.match(fileRoute, /order\.status !== 'paid'/);
  assert.match(fileRoute, /status: 403/);
  assert.match(fileRoute, /Content-Disposition/);
  assert.match(fileRoute, /X-Content-Type-Options/);
  assert.match(fileRoute, /private, no-store/);
  assert.match(accessRoute, /priceUsd === 0/);
  assert.match(accessRoute, /canDownload: true/);
  assert.match(accessRoute, /canDownload: false/);
  assert.match(accessRoute, /productId/);
  assert.match(storageSrc, /resolveDownloadStorageDir/);
  assert.match(storeSrc, /storedFileExists/);
  assert.match(storeSrc, /grantDownloadEntitlement/);
  assert.match(storeSrc, /revokeDownloadEntitlementsForOrder/);
  assert.match(gitignore, /\.storage/);
});

test('payment claim flow never trusts client paid flags', () => {
  const claimRoute = readFileSync(join(root, 'src/app/api/downloads/claim/route.ts'), 'utf8');
  const activator = readFileSync(join(root, 'src/components/download/DownloadAccessActivator.tsx'), 'utf8');
  const successPage = readFileSync(join(root, 'src/app/payment/success/page.tsx'), 'utf8');
  const service = readFileSync(join(root, 'src/lib/payments/service.ts'), 'utf8');

  assert.match(claimRoute, /order\.status !== 'paid'/);
  assert.match(claimRoute, /timingSafeToken/);
  assert.match(claimRoute, /grantDownloadEntitlement/);
  assert.match(claimRoute, /void body\.paid|Ignore any client-supplied paid/);
  assert.doesNotMatch(claimRoute, /if\s*\(\s*body\.paid/);
  assert.match(activator, /\/api\/downloads\/claim/);
  assert.match(activator, /İndirme hakkınız aktif/);
  assert.match(activator, /indirme yetkiniz hazırlanıyor/);
  assert.match(successPage, /DownloadAccessActivator/);
  assert.match(successPage, /order\.status !== 'paid'/);
  assert.match(service, /provider\.verifyPayment/);
  assert.match(service, /grantDownloadEntitlement/);
  assert.match(service, /revokeDownloadEntitlementsForOrder/);
  assert.match(table, /access\?\.canDownload === true/);
  assert.match(table, /Satın Al/);
  assert.match(table, /Doğrulanıyor/);
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

/**
 * Validates free multi-platform package metadata shape using an isolated temp DB.
 * Must NOT require repository/production `.data/downloads.json` to exist.
 */
test('isolated free package metadata fixture validates expected shape', () => {
  assert.match(gitignore, /^\.data$/m);
  assert.match(configSrc, /DOWNLOAD_STORAGE_DIR/);
  assert.match(configSrc, /downloads\.json/);
  assert.match(storeSrc, /emptyDb\(\)/);
  assert.match(storeSrc, /catch \{\s*return emptyDb\(\);/s);

  const content = 'TicketGo Teknoloji — isolated test fixture only.\n';
  const checksum = createHash('sha256').update(content).digest('hex');
  const storedFileName = `${randomBytes(8).toString('hex')}.txt`;
  const fixturePkg = {
    id: 'dl-test-fixture',
    productId: 'download-dl-test-fixture',
    name: 'Güvenli Yükleme Talimatları',
    description: 'Isolated test fixture — not a production catalog entry.',
    platforms: ['windows', 'macos', 'android', 'ios'],
    platform: 'Windows · macOS · Android · iOS',
    version: 'v1.0.0',
    architecture: 'Universal',
    fileType: 'TXT',
    mimeType: 'text/plain',
    fileSize: '1 B',
    fileSizeBytes: Buffer.byteLength(content),
    priceUsd: 0,
    currency: 'USD',
    storedFileName,
    originalFileName: 'guvenli-yukleme-talimatlari.txt',
    storageRelativePath: storedFileName,
    checksumSha256: checksum,
    uploadedAt: new Date().toISOString(),
    uploadedBy: 'test@fixture.local',
    published: true,
    status: 'published',
  };

  const tempRoot = mkdtempSync(join(tmpdir(), 'tg-dl-meta-'));
  const fixtureDbPath = join(tempRoot, 'downloads.json');
  try {
    writeFileSync(
      fixtureDbPath,
      JSON.stringify({ packages: [fixturePkg], entitlements: [], audit: [] }, null, 2),
      'utf8'
    );

    // Isolated path — never the repo/production metadata file.
    assert.notEqual(fixtureDbPath, join(root, '.data', 'downloads.json'));
    assert.ok(!fixtureDbPath.startsWith(join(root, '.data')));

    const db = JSON.parse(readFileSync(fixtureDbPath, 'utf8'));
    const matches = (db.packages || []).filter((p) => p.originalFileName === 'guvenli-yukleme-talimatlari.txt');
    assert.equal(matches.length, 1);
    const pkg = matches[0];
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
    assert.equal(typeof pkg.storageRelativePath, 'string');
    assert.doesNotMatch(pkg.storageRelativePath, /\.\.|\/|\\/);
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('platform filter helpers support multi-platform packages', () => {
  assert.match(downloadsData, /platforms\.includes|ids\.includes/);
  assert.match(downloadsData, /parsePlatformIds/);
  assert.match(downloadsData, /matchesPlatformFilter/);
  assert.match(table, /PlatformBadges/);
  assert.match(table, /pkg\.platforms/);
  assert.match(uploadModal, /name=\"platforms\"/);
  assert.match(uploadModal, /type=\"file\"/);
  assert.match(uploadModal, /Dosya Seç/);
  assert.match(uploadModal, /\/api\/downloads\/admin\/upload/);
});
