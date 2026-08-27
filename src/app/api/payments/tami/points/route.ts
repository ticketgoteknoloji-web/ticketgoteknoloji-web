import { NextResponse } from 'next/server';
import { clientIp, originAllowed, paymentLog, rateLimit } from '@/lib/payments/security';
import { queryTamiPoints } from '@/lib/payments/tami-points';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  if (request.method !== 'POST') {
    return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
  }
  if (!originAllowed(request.headers)) {
    return NextResponse.json({ error: 'Origin doğrulanamadı.' }, { status: 403 });
  }
  const ip = clientIp(request.headers);
  if (!rateLimit(`tami-points:${ip}`, 10, 60_000)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  let raw: Record<string, unknown> = {};
  try {
    raw = (await request.json()) as Record<string, unknown>;
  } catch {
    raw = {};
  }

  const quote = await queryTamiPoints({ ip, body: raw });
  paymentLog('tami_points_http', {
    success: quote.ok,
    available: quote.available,
  });

  return NextResponse.json({
    success: quote.ok,
    available: quote.available,
    amountLabel: quote.amountLabel,
    redeemable: quote.redeemable,
    message: quote.message,
  });
}
