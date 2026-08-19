import { NextResponse } from 'next/server';
import { finalizeFromCallback } from '@/lib/payments/service';
import { clientIp, paymentLog, rateLimit, stripCardFields } from '@/lib/payments/security';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function payloadFrom(request: Request): Promise<Record<string, string>> {
  const payload: Record<string, string> = {};
  const contentType = request.headers.get('content-type') ?? '';
  if (request.method === 'POST' && contentType.includes('json')) {
    const json = (await request.json()) as Record<string, unknown>;
    for (const [key, value] of Object.entries(json)) {
      if (typeof value === 'string' || typeof value === 'number') payload[key] = String(value);
    }
  } else if (request.method === 'POST') {
    const form = await request.formData();
    form.forEach((value, key) => {
      if (typeof value === 'string') payload[key] = value;
    });
  }
  return stripCardFields(payload) as Record<string, string>;
}

export async function POST(request: Request) {
  const ip = clientIp(request.headers);
  if (!rateLimit(`wh:qnbpay:${ip}`, 40, 60_000)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }
  const payload = await payloadFrom(request);
  paymentLog('qnbpay_webhook', { hasInvoice: Boolean(payload.invoice_id) });
  const order = await finalizeFromCallback('qnbpay', payload);
  if (!order) return NextResponse.json({ ok: false }, { status: 404 });
  return NextResponse.json({ ok: true, status: order.status });
}
