import { NextResponse } from 'next/server';
import { getOrderById } from '@/lib/payments/orders';
import { toPublicOrder } from '@/lib/payments/service';
import { clientIp, rateLimit, timingSafeToken } from '@/lib/payments/security';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const ip = clientIp(request.headers);
  if (!rateLimit(`status:${ip}`, 30, 60_000)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }
  const url = new URL(request.url);
  const id = url.searchParams.get('order') ?? '';
  const token = url.searchParams.get('token') ?? '';
  const order = await getOrderById(id);
  if (!order || !timingSafeToken(order.statusToken, token)) {
    return NextResponse.json({ error: 'Sipariş bulunamadı.' }, { status: 404 });
  }
  return NextResponse.json(toPublicOrder(order));
}
