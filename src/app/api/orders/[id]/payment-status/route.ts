import { NextResponse } from 'next/server';
import { getOrderById } from '@/lib/payments/orders';
import { toPublicOrder } from '@/lib/payments/service';
import { clientIp, rateLimit, timingSafeToken } from '@/lib/payments/security';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  const ip = clientIp(request.headers);
  if (!rateLimit(`order-status:${ip}`, 20, 60_000)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }
  const { id } = await params;
  const token = new URL(request.url).searchParams.get('token') ?? '';
  const order = await getOrderById(id);
  if (!order || !timingSafeToken(order.statusToken, token)) {
    return NextResponse.json({ error: 'Sipariş bulunamadı.' }, { status: 404 });
  }
  return NextResponse.json(toPublicOrder(order));
}
