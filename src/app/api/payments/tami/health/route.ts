import { NextResponse } from 'next/server';
import { paymentEnv, tamiConfig } from '@/lib/payments/config';
import { tamiHealth } from '@/lib/payments/tami';
import { hmacEquals, hmacSign, rateLimit, clientIp } from '@/lib/payments/security';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function adminAllowed(request: Request): boolean {
  if (paymentEnv() !== 'production' || tamiConfig().env !== 'production') return true;
  const key = process.env.PAYMENT_ADMIN_KEY?.trim();
  if (!key) return false;
  const provided = request.headers.get('x-ticketgo-admin') ?? '';
  return hmacEquals(hmacSign(key), hmacSign(provided));
}

export async function GET(request: Request) {
  const ip = clientIp(request.headers);
  if (!rateLimit(`tami-health:${ip}`, 10, 60_000)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }
  if (!adminAllowed(request)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const health = await tamiHealth();
  return NextResponse.json({
    status: `Tami: ${health.status}`,
    env: health.env,
    configured: health.configured,
    ...(health.configured ? { baseUrl: tamiConfig().baseUrl } : {}),
  });
}
