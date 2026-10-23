import { NextResponse } from 'next/server';
import { getUsdTryQuote } from '@/services/exchange-rate';
import { clientIp, rateLimit } from '@/lib/payments/security';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const ip = clientIp(request.headers);
  if (!rateLimit(`fx:usd-try:${ip}`, 60, 60_000)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const quote = await getUsdTryQuote();
  return NextResponse.json(
    {
      base: quote.base,
      quote: quote.quote,
      rate: quote.rate,
      source: quote.source,
      rateType: quote.rateType,
      date: quote.date,
      updatedAt: quote.updatedAt,
      status: quote.status,
    },
    {
      headers: {
        'Cache-Control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=300',
      },
    }
  );
}
