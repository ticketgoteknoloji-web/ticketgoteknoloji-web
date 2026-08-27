import { NextResponse } from 'next/server';
import { getAttemptById, getOrderById } from '@/lib/payments/orders';
import { publicBaseUrl } from '@/lib/payments/config';
import { takeTami3dsHtml, tamiLaunchTokenOk } from '@/lib/payments/tami-3ds';
import { clientIp, paymentLog, rateLimit } from '@/lib/payments/security';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const ip = clientIp(request.headers);
  if (!rateLimit(`tami-launch:${ip}`, 20, 60_000)) {
    return NextResponse.redirect(`${publicBaseUrl(request)}/payment/failure`);
  }
  const url = new URL(request.url);
  const orderId = url.searchParams.get('order') ?? '';
  const attemptId = url.searchParams.get('attempt') ?? '';
  const sig = url.searchParams.get('sig') ?? '';
  const order = await getOrderById(orderId);
  const attempt = await getAttemptById(attemptId);
  if (!order || !attempt || attempt.orderId !== order.id || !tamiLaunchTokenOk(attempt.id, order.id, sig)) {
    return NextResponse.redirect(`${publicBaseUrl(request)}/payment/failure`);
  }
  if (order.status === 'paid') {
    return NextResponse.redirect(`${publicBaseUrl(request)}/payment/success?order=${encodeURIComponent(order.id)}`);
  }
  const html = takeTami3dsHtml(attempt.id, order.id);
  if (!html) {
    paymentLog('tami_launch_missing_html', { orderNumber: order.orderNumber });
    return NextResponse.redirect(`${publicBaseUrl(request)}/payment/failure?order=${encodeURIComponent(order.id)}`);
  }
  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
