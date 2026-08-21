import { NextResponse } from 'next/server';
import { readAccessTokens } from '@/lib/downloads/auth';
import {
  absoluteStoragePath,
  findValidEntitlement,
  getStoredPackageByProductId,
  revokeDownloadEntitlementsForOrder,
} from '@/lib/downloads/store';
import type { DownloadAccessState } from '@/lib/downloads/types';
import { getOrderById } from '@/lib/payments/orders';
import { clientIp, rateLimit } from '@/lib/payments/security';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ productId: string }> };

function jsonAccess(body: {
  productId: string;
  state: DownloadAccessState;
  canDownload: boolean;
  label?: string;
  paymentUrl?: string;
  free?: boolean;
}) {
  return NextResponse.json(body);
}

export async function GET(request: Request, { params }: Params) {
  const ip = clientIp(request.headers);
  if (!rateLimit(`download-access:${ip}`, 60, 60_000)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const { productId: rawId } = await params;
  const productId = decodeURIComponent(rawId || '').trim();
  if (!productId || productId.includes('..') || productId.includes('/')) {
    return jsonAccess({ productId: productId || '', state: 'no_file', canDownload: false, label: 'Henüz yayınlanmadı' });
  }

  const pkg = await getStoredPackageByProductId(productId);
  if (!pkg) {
    return jsonAccess({ productId, state: 'no_file', canDownload: false, label: 'Henüz yayınlanmadı' });
  }

  if (pkg.published === false) {
    return jsonAccess({
      productId: pkg.productId,
      state: 'unpublished',
      canDownload: false,
      label: 'Henüz yayınlanmadı',
    });
  }

  const filePath = await absoluteStoragePath(pkg);
  if (!filePath) {
    return jsonAccess({
      productId: pkg.productId,
      state: 'no_file',
      canDownload: false,
      label: 'Henüz yayınlanmadı',
    });
  }

  // Explicit 0 = free. null = not for sale (do not open download).
  if (pkg.priceUsd === 0) {
    return jsonAccess({
      productId: pkg.productId,
      state: 'download_ready',
      canDownload: true,
      label: 'İndir',
      free: true,
    });
  }

  if (pkg.priceUsd == null || pkg.priceUsd < 0) {
    return jsonAccess({
      productId: pkg.productId,
      state: 'price_undefined',
      canDownload: false,
      label: 'Fiyat tanımlanmadı',
    });
  }

  const tokens = await readAccessTokens();
  const entitlement = await findValidEntitlement({ productId: pkg.productId, statusTokens: tokens });
  if (entitlement) {
    const order = await getOrderById(entitlement.orderId);
    if (order?.status === 'paid' && order.productId === pkg.productId) {
      return jsonAccess({
        productId: pkg.productId,
        state: 'download_ready',
        canDownload: true,
        label: 'İndir',
      });
    }

    if (order?.status === 'refunded' || order?.status === 'cancelled' || order?.status === 'failed') {
      await revokeDownloadEntitlementsForOrder(entitlement.orderId);
      return jsonAccess({
        productId: pkg.productId,
        state: order.status === 'failed' ? 'payment_failed' : 'purchase_required',
        canDownload: false,
        label: order.status === 'failed' ? 'Ödemeyi Tekrarla' : 'Satın Al',
        paymentUrl: `/payment?productId=${encodeURIComponent(pkg.productId)}&period=once`,
      });
    }

    if (
      order?.status === 'awaiting_payment' ||
      order?.status === 'processing' ||
      order?.status === 'pending' ||
      order?.status === 'payment_started'
    ) {
      return jsonAccess({
        productId: pkg.productId,
        state: 'payment_pending',
        canDownload: false,
        label: 'Doğrulanıyor...',
      });
    }
  }

  return jsonAccess({
    productId: pkg.productId,
    state: 'purchase_required',
    canDownload: false,
    label: 'Satın Al',
    paymentUrl: `/payment?productId=${encodeURIComponent(pkg.productId)}&period=once`,
  });
}
