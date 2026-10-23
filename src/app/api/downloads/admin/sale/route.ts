import { NextResponse } from 'next/server';
import { readAdminSession } from '@/lib/downloads/auth';
import { storedFileExists } from '@/lib/downloads/storage';
import { toPublicPackage, updatePackageSaleOpen } from '@/lib/downloads/store';
import { clientIp, rateLimit } from '@/lib/payments/security';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const ip = clientIp(request.headers);
  if (!rateLimit(`download-admin-sale:${ip}`, 30, 60_000)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const session = await readAdminSession();
  if (!session) {
    return NextResponse.json({ error: 'Yetkisiz.' }, { status: 401 });
  }

  let body: { productId?: unknown; saleOpen?: unknown };
  try {
    body = (await request.json()) as { productId?: unknown; saleOpen?: unknown };
  } catch {
    return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 400 });
  }

  const productId = typeof body.productId === 'string' ? body.productId.trim() : '';
  if (!productId || productId.includes('..') || productId.includes('/') || productId.includes('\\')) {
    return NextResponse.json({ error: 'Paket bulunamadı.' }, { status: 400 });
  }
  if (typeof body.saleOpen !== 'boolean') {
    return NextResponse.json({ error: 'Geçerli bir satış durumu seçin.' }, { status: 400 });
  }

  const updated = await updatePackageSaleOpen(productId, body.saleOpen);
  if (!updated) {
    return NextResponse.json({ error: 'Paket bulunamadı.' }, { status: 404 });
  }

  const fileAvailable = await storedFileExists(updated.storageRelativePath || updated.storedFileName);
  return NextResponse.json({
    ok: true,
    package: toPublicPackage(updated, fileAvailable),
  });
}
