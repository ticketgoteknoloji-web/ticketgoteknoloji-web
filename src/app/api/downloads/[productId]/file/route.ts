import { createReadStream } from 'fs';
import { NextResponse } from 'next/server';
import { Readable } from 'stream';
import { readAccessTokens } from '@/lib/downloads/auth';
import {
  absoluteStoragePath,
  appendDownloadAudit,
  findValidEntitlement,
  getStoredPackageByProductId,
} from '@/lib/downloads/store';
import { getOrderById } from '@/lib/payments/orders';
import { clientIp, rateLimit } from '@/lib/payments/security';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ productId: string }> };

export async function GET(request: Request, { params }: Params) {
  const ip = clientIp(request.headers);
  if (!rateLimit(`download-file:${ip}`, 60, 60_000)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const { productId: rawId } = await params;
  const productId = decodeURIComponent(rawId || '').trim();
  if (!productId || productId.includes('..') || productId.includes('/')) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const pkg = await getStoredPackageByProductId(productId);
  if (!pkg || pkg.published === false) {
    await appendDownloadAudit({ event: 'download_denied', productId });
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const filePath = await absoluteStoragePath(pkg);
  if (!filePath) {
    await appendDownloadAudit({ event: 'download_denied', productId: pkg.productId, fileName: pkg.originalFileName });
    return NextResponse.json({ error: 'Dosya kullanılamıyor' }, { status: 404 });
  }

  const isFree = pkg.priceUsd === 0;
  if (!isFree) {
    if (pkg.priceUsd == null || pkg.priceUsd < 0) {
      await appendDownloadAudit({ event: 'download_denied', productId: pkg.productId });
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const tokens = await readAccessTokens();
    const urlToken = new URL(request.url).searchParams.get('token');
    const statusTokens = urlToken ? Array.from(new Set([...tokens, urlToken])) : tokens;

    const entitlement = await findValidEntitlement({ productId: pkg.productId, statusTokens });
    if (!entitlement) {
      await appendDownloadAudit({ event: 'download_denied', productId: pkg.productId });
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const order = await getOrderById(entitlement.orderId);
    if (!order || order.status !== 'paid' || order.productId !== pkg.productId) {
      await appendDownloadAudit({ event: 'download_denied', productId: pkg.productId });
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  const nodeStream = createReadStream(filePath);
  const webStream = Readable.toWeb(nodeStream) as unknown as ReadableStream;
  const dispositionName = pkg.originalFileName.replace(/"/g, '');

  await appendDownloadAudit({
    event: 'download_success',
    productId: pkg.productId,
    fileName: pkg.originalFileName,
    fileSize: pkg.fileSizeBytes,
  });

  return new NextResponse(webStream, {
    status: 200,
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${dispositionName}"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
      'Content-Length': String(pkg.fileSizeBytes),
    },
  });
}
