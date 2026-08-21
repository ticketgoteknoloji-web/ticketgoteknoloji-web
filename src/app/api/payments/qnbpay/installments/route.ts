import { NextResponse } from 'next/server';
import { quoteProduct, type PaymentPeriod } from '@/lib/commerce-server';
import { fromMinorUnits } from '@/lib/money';
import { getEnabledQnbCardPrograms } from '@/config/qnbpay-card-programs';
import { originAllowed, rateLimit, clientIp, paymentLog } from '@/lib/payments/security';
import { qnbpayGetPos } from '@/lib/payments/qnbpay';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  if (!originAllowed(request.headers)) {
    return NextResponse.json({ error: 'Origin doğrulanamadı.' }, { status: 403 });
  }
  const ip = clientIp(request.headers);
  if (!rateLimit(`qnb-pos:${ip}`, 20, 60_000)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const bin = String(body.bin ?? '').replace(/\D/g, '').slice(0, 6);
  if (bin.length < 6) {
    return NextResponse.json({ error: 'Kart programı için BIN (ilk 6 hane) gerekir.' }, { status: 400 });
  }
  const productId = String(body.productId ?? '').trim();
  const period = body.period as PaymentPeriod;
  const quote = quoteProduct({ productId, period: period === 'monthly' || period === 'once' ? period : 'annual', quantity: Number(body.quantity ?? 1) });
  if ('error' in quote) return NextResponse.json({ error: quote.error }, { status: 400 });

  paymentLog('qnbpay_getpos', { productId: quote.productId, binLength: bin.length });
  const result = await qnbpayGetPos({ bin, amount: fromMinorUnits(quote.totalMinor), currency: quote.currency });
  if (!result.ok) return NextResponse.json({ options: [], message: result.message });

  const enabled = new Set(getEnabledQnbCardPrograms().map((item) => item.id.toUpperCase()));
  const options = result.options
    .filter((item) => {
      const program = (item.card_program ?? '').toLowerCase();
      if (!enabled.size) return false;
      return [...enabled].some((id) => program.includes(id.toLowerCase()));
    })
    .map((item) => ({
      installment: item.installments_number ?? 1,
      program: item.card_program ?? '',
      network: item.card_scheme ?? '',
      bank: item.card_bank ?? '',
      title: item.title ?? '',
      payable: item.amount_to_be_paid ?? String(item.payable_amount ?? ''),
    }));
  return NextResponse.json({ options });
}
