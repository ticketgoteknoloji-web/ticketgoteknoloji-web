import { NextResponse } from 'next/server';
import { readAccessTokens } from '@/lib/downloads/auth';
import {
  absoluteStoragePath,
  findValidEntitlement,
  getStoredPackageByProductId,
} from '@/lib/downloads/store';
import type { DownloadAccessState } from '@/lib/downloads/types';
import { getOrderById } from '@/lib/payments/orders';
import { clientIp, rateLimit } from '@/lib/payments/security';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ productId: string }> };

export async function GET(request: Request, { params }: Params) {
  const ip = clientIp(request.headers);
  if (!rateLimit(`download-access:${ip}`, 60, 60_000)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const { productId: rawId } = await params;
  const productId = decodeURIComponent(rawId || '').trim();
  const pkg = await getStoredPackageByProductId(productId);
  if (!pkg) {
    return NextResponse.json({ state: 'no_file' satisfies DownloadAccessState, canDownload: false });
  }

  if (pkg.published === false) {
    return NextResponse.json({
      state: 'unpublished' satisfies DownloadAccessState,
      canDownload: false,
      label: 'Yayında değil',
    });
  }

  const filePath = await absoluteStoragePath(pkg);
  if (!filePath) {
    return NextResponse.json({
      state: 'no_file' satisfies DownloadAccessState,
      canDownload: false,
      label: 'Dosya kullanılamıyor',
    });
  }

  // Free package (explicit 0) — no payment required; still served via secure endpoint.
  if (pkg.priceUsd === 0) {
    return NextResponse.json({
      state: 'download_ready' satisfies DownloadAccessState,
      canDownload: true,
      label: 'İndir',
      free: true,
    });
  }

  if (pkg.priceUsd == null) {
    return NextResponse.json({
      state: 'price_undefined' satisfies DownloadAccessState,
      canDownload: false,
      label: 'Fiyat tanımlanmadı',
    });
  }

  const tokens = await readAccessTokens();
  const entitlement = await findValidEntitlement({ productId: pkg.productId, statusTokens: tokens });
  if (entitlement) {
    const order = await getOrderById(entitlement.orderId);
    if (order?.status === 'paid') {
      return NextResponse.json({
        state: 'download_ready' satisfies DownloadAccessState,
        canDownload: true,
        label: 'İndir',
      });
    }
    if (order?.status === 'awaiting_payment' || order?.status === 'processing' || order?.status === 'pending') {
      return NextResponse.json({
        state: 'payment_pending' satisfies DownloadAccessState,
        canDownload: false,
        label: 'Ödeme Bekleniyor',
      });
    }
    if (order?.status === 'failed' || order?.status === 'cancelled') {
      return NextResponse.json({
        state: 'payment_failed' satisfies DownloadAccessState,
        canDownload: false,
        label: 'Ödemeyi Tekrarla',
      });
    }
  }

  return NextResponse.json({
    state: 'purchase_required' satisfies DownloadAccessState,
    canDownload: false,
    label: 'Satın Al',
    paymentUrl: `/payment?productId=${encodeURIComponent(pkg.productId)}&period=once`,
  });
}
