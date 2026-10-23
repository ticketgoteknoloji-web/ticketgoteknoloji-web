import { NextResponse } from 'next/server';
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
        if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
          payload[key] = String(value);
        }
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
  if (!rateLimit(`cb:tami:${ip}`, 30, 60_000)) {
    return NextResponse.redirect(`${publicBaseUrl()}/payment/failure`);
  }
  const payload = await payloadFrom(request);
  paymentLog('tami_callback', {
    hasOrderId: Boolean(payload.orderId),
    mdStatus: payload.mdStatus || null,
    success: payload.success || null,
  });
  const order = await finalizeFromCallback('tami', payload);
  if (!order) return NextResponse.redirect(`${publicBaseUrl()}/payment/failure`);
  if (order.status === 'paid') {
    return NextResponse.redirect(`${publicBaseUrl()}/payment/success?order=${encodeURIComponent(order.id)}`);
  }
  if (order.status === 'cancelled') {
    return NextResponse.redirect(`${publicBaseUrl()}/payment/cancelled?order=${encodeURIComponent(order.id)}`);
  }
  return NextResponse.redirect(`${publicBaseUrl()}/payment/failure?order=${encodeURIComponent(order.id)}`);
}

export const POST = handle;
export const GET = handle;
