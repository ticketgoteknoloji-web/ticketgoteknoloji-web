import { NextResponse } from 'next/server';
import { paymentEnv } from '@/lib/payments/config';
import { qnbpayHealth } from '@/lib/payments/qnbpay';
import { hmacEquals, hmacSign, rateLimit, clientIp } from '@/lib/payments/security';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function adminAllowed(request: Request): boolean {
  if (paymentEnv() !== 'production') return true;
  const key = process.env.PAYMENT_ADMIN_KEY?.trim();
  if (!key) return false;
  const provided = request.headers.get('x-ticketgo-admin') ?? '';
  return hmacEquals(hmacSign(key), hmacSign(provided));
}

export async function GET(request: Request) {
  const ip = clientIp(request.headers);
  if (!rateLimit(`qnb-health:${ip}`, 10, 60_000)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }
  if (!adminAllowed(request)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const health = await qnbpayHealth();
  return NextResponse.json({
    status: `QNBpay: ${health.status}`,
    env: health.env,
    mode: health.mode,
    sipay: health.sipay,
    payfor: health.payfor,
  });
}
