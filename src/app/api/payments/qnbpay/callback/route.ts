import { NextResponse } from 'next/server';
import {
  adminCookieOptions,
  DOWNLOAD_ACCESS_COOKIE,
  mergeAccessTokens,
} from '@/lib/downloads/auth';
import { getStoredPackageByProductId } from '@/lib/downloads/store';
import { finalizeFromCallback } from '@/lib/payments/service';
import { paymentLog, rateLimit, clientIp, stripCardFields } from '@/lib/payments/security';
import { publicBaseUrl } from '@/lib/payments/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function payloadFrom(request: Request): Promise<Record<string, string>> {
  const payload: Record<string, string> = {};
  if (request.method === 'POST') {
    const contentType = request.headers.get('content-type') ?? '';
    if (contentType.includes('json')) {
      const json = (await request.json()) as Record<string, unknown>;
      for (const [key, value] of Object.entries(json)) {
        if (typeof value === 'string' || typeof value === 'number') payload[key] = String(value);
      }
    } else {
      const form = await request.formData();
      form.forEach((value, key) => {
        if (typeof value === 'string') payload[key] = value;
      });
    }
  } else {
    const url = new URL(request.url);
    url.searchParams.forEach((value, key) => {
      payload[key] = value;
    });
  }
  return stripCardFields(payload) as Record<string, string>;
}

async function handle(request: Request) {
  const ip = clientIp(request.headers);
  if (!rateLimit(`cb:qnbpay:${ip}`, 30, 60_000)) {
    return NextResponse.redirect(`${publicBaseUrl()}/payment/failure`);
  }
  const payload = await payloadFrom(request);
  paymentLog('qnbpay_callback', { hasInvoice: Boolean(payload.invoice_id) });
  const order = await finalizeFromCallback('qnbpay', payload);
  if (!order) return NextResponse.redirect(`${publicBaseUrl()}/payment/failure`);
  if (order.status === 'paid') {
    const response = NextResponse.redirect(
      `${publicBaseUrl()}/payment/success?order=${encodeURIComponent(order.id)}`
    );
    const downloadPkg = await getStoredPackageByProductId(order.productId);
    if (downloadPkg) {
      const cookieHeader = request.headers.get('cookie') ?? '';
      const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${DOWNLOAD_ACCESS_COOKIE}=([^;]*)`));
      const existing = match?.[1] ? decodeURIComponent(match[1]) : undefined;
      response.cookies.set(DOWNLOAD_ACCESS_COOKIE, mergeAccessTokens(existing, order.statusToken), {
        ...adminCookieOptions(30 * 24 * 60 * 60),
        sameSite: 'lax',
      });
    }
    return response;
  }
  if (order.status === 'cancelled') {
    return NextResponse.redirect(`${publicBaseUrl()}/payment/cancelled?order=${encodeURIComponent(order.id)}`);
  }
  return NextResponse.redirect(`${publicBaseUrl()}/payment/failure?order=${encodeURIComponent(order.id)}`);
}

export const POST = handle;
export const GET = handle;
