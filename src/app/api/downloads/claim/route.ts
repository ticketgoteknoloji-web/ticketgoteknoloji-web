import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import {
  adminCookieOptions,
  DOWNLOAD_ACCESS_COOKIE,
  mergeAccessTokens,
} from '@/lib/downloads/auth';
import { grantDownloadEntitlement, getStoredPackageByProductId } from '@/lib/downloads/store';
import { getOrderById } from '@/lib/payments/orders';
import { clientIp, rateLimit, timingSafeToken } from '@/lib/payments/security';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Claims download access after a verified paid order.
 * Requires order id + statusToken — never trusts client "paid" flags.
 */
export async function POST(request: Request) {
  const ip = clientIp(request.headers);
  if (!rateLimit(`download-claim:${ip}`, 20, 60_000)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  let body: { orderId?: string; token?: string; paid?: boolean };
  try {
    body = (await request.json()) as { orderId?: string; token?: string; paid?: boolean };
  } catch {
    return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 400 });
  }

  // Ignore any client-supplied paid flag entirely.
  void body.paid;

  const orderId = typeof body.orderId === 'string' ? body.orderId.trim() : '';
  const token = typeof body.token === 'string' ? body.token.trim() : '';
  if (!orderId || !token) {
    return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 400 });
  }

  const order = await getOrderById(orderId);
  if (!order || !timingSafeToken(order.statusToken, token)) {
    return NextResponse.json({ error: 'Yetkisiz.' }, { status: 403 });
  }
  if (order.status !== 'paid') {
    return NextResponse.json(
      {
        error: 'Ödeme doğrulanmadı.',
        status: order.status,
        canDownload: false,
      },
      { status: 403 }
    );
  }

  const pkg = await getStoredPackageByProductId(order.productId);
  if (!pkg || pkg.productId !== order.productId) {
    return NextResponse.json({
      ok: true,
      downloadProduct: false,
      canDownload: false,
      productId: order.productId,
    });
  }

  const entitlement = await grantDownloadEntitlement({
    orderId: order.id,
    productId: order.productId,
    paymentId: order.paymentTransactionId ?? order.providerPaymentId,
    statusToken: order.statusToken,
    customerEmail: order.customerEmail,
  });

  if (!entitlement) {
    return NextResponse.json({ error: 'İndirme yetkisi oluşturulamadı.' }, { status: 500 });
  }

  const jar = await cookies();
  const next = mergeAccessTokens(jar.get(DOWNLOAD_ACCESS_COOKIE)?.value, order.statusToken);
  const response = NextResponse.json({
    ok: true,
    downloadProduct: true,
    canDownload: true,
    productId: order.productId,
    entitlementId: entitlement.id,
    grantedAt: entitlement.grantedAt,
  });
  response.cookies.set(DOWNLOAD_ACCESS_COOKIE, next, {
    ...adminCookieOptions(30 * 24 * 60 * 60),
    sameSite: 'lax',
  });
  return response;
}
