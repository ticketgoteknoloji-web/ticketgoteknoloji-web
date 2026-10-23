import { NextResponse } from 'next/server';
import { clientIp, originAllowed, paymentLog, rateLimit } from '@/lib/payments/security';
import { normalizeTamiCheckoutBin, queryTamiInstallments } from '@/lib/payments/tami-installments';

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
  if (!rateLimit(`tami-installments:${ip}`, 20, 60_000)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  let raw: Record<string, unknown> = {};
  try {
    raw = (await request.json()) as Record<string, unknown>;
  } catch {
    raw = {};
  }

  const bin = normalizeTamiCheckoutBin(String(raw.bin ?? ''));
  if (!bin) {
    return NextResponse.json({ error: 'Kart programı için BIN (ilk 6 hane) gerekir.' }, { status: 400 });
  }

  const quote = await queryTamiInstallments(bin);
  paymentLog('tami_installments_http', {
    success: quote.success,
    installmentCounts: quote.installments.filter((item) => item.enabled).map((item) => item.count),
    fallback: quote.fallback,
  });

  return NextResponse.json({
    success: quote.success,
    cardFamily: quote.cardFamily,
    installments: quote.installments,
    fallback: quote.fallback,
    message: quote.message ?? null,
  });
}
