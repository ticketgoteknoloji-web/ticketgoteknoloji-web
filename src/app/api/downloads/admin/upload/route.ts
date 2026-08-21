import { NextResponse } from 'next/server';
import { readAdminSession } from '@/lib/downloads/auth';
import { toPublicPackage } from '@/lib/downloads/store';
import { persistAdminUpload } from '@/lib/downloads/upload';
import { clientIp, paymentLog, rateLimit } from '@/lib/payments/security';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const ip = clientIp(request.headers);
  if (!rateLimit(`download-admin-upload:${ip}`, 20, 60_000)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const session = await readAdminSession();
  if (!session) {
    return NextResponse.json({ error: 'Yetkisiz.' }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Geçersiz form verisi.' }, { status: 400 });
  }

  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Dosya seçilmedi.' }, { status: 400 });
  }

  const priceRaw = String(form.get('priceUsd') ?? '').trim();
  let priceUsd: number | null = null;
  if (priceRaw !== '') {
    const parsed = Number(priceRaw);
    if (!Number.isFinite(parsed)) {
      return NextResponse.json({ error: 'Geçerli bir fiyat girin.' }, { status: 400 });
    }
    priceUsd = parsed;
  }

  const publishedRaw = String(form.get('published') ?? 'true').trim().toLowerCase();
  const published = publishedRaw !== 'false' && publishedRaw !== '0';

  const result = await persistAdminUpload({
    adminEmail: 'download-admin',
    name: String(form.get('name') ?? ''),
    description: String(form.get('description') ?? ''),
    platforms: [
      ...form.getAll('platforms').map((value) => String(value)),
      String(form.get('platform') ?? ''),
    ].filter(Boolean),
    version: String(form.get('version') ?? ''),
    architecture: String(form.get('architecture') ?? 'Universal'),
    priceUsd,
    currency: String(form.get('currency') ?? 'USD'),
    published,
    replaceProductId: String(form.get('replaceProductId') ?? '').trim() || null,
    file,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  paymentLog('download_admin_upload', {
    productId: result.package.productId,
    fileName: result.package.originalFileName,
    fileSize: result.package.fileSizeBytes,
    admin: session.role,
  });

  return NextResponse.json({
    ok: true,
    package: toPublicPackage(result.package, true),
  });
}
