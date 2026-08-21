import { NextResponse } from 'next/server';
import { quoteProduct, type PaymentPeriod } from '@/lib/commerce-server';
import { clientIp, originAllowed, paymentLog, rateLimit } from '@/lib/payments/security';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  if (!originAllowed(request.headers) && request.headers.get('origin')) {
    return NextResponse.json({ error: 'Origin doğrulanamadı.' }, { status: 403 });
  }
  const ip = clientIp(request.headers);
  if (!rateLimit(`quote:${ip}`, 40, 60_000)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const url = new URL(request.url);
  if (url.searchParams.has('price') || url.searchParams.has('amount')) {
    paymentLog('price_query_ignored', {});
  }

  const period = (url.searchParams.get('period') ?? 'monthly') as PaymentPeriod;
  const quote = quoteProduct({
    productId: url.searchParams.get('product') ?? '',
    period,
    quantity: Number(url.searchParams.get('qty') ?? '1'),
  });
  if ('error' in quote) {
    return NextResponse.json({ error: quote.error }, { status: 400 });
  }
  return NextResponse.json(quote);
}
