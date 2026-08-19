import { NextResponse } from 'next/server';
import { build3DHostFields, hashesMatch, launchToken } from '@/lib/payments/qnb-payfor';
import { getAttemptById, getOrderById } from '@/lib/payments/orders';
import { qnbpayConfig } from '@/lib/payments/config';
import { publicBaseUrl } from '@/lib/payments/config';
import { paymentLog, rateLimit, clientIp } from '@/lib/payments/security';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export async function GET(request: Request) {
  const ip = clientIp(request.headers);
  if (!rateLimit(`qnb-launch:${ip}`, 20, 60_000)) {
    return NextResponse.redirect(`${publicBaseUrl(request)}/payment/failure`);
  }
  const url = new URL(request.url);
  const orderId = url.searchParams.get('order') ?? '';
  const attemptId = url.searchParams.get('attempt') ?? '';
  const sig = url.searchParams.get('sig') ?? '';
  const order = await getOrderById(orderId);
  const attempt = await getAttemptById(attemptId);
  if (!order || !attempt || attempt.orderId !== order.id || !hashesMatch(launchToken(attempt.id, order.id), sig)) {
    return NextResponse.redirect(`${publicBaseUrl(request)}/payment/failure`);
  }
  if (order.status === 'paid') {
    return NextResponse.redirect(`${publicBaseUrl(request)}/payment/success?order=${encodeURIComponent(order.id)}`);
  }
  if (!qnbpayConfig().payforConfigured) {
    paymentLog('qnbpay_launch_missing_credentials', { orderNumber: order.orderNumber });
    return NextResponse.redirect(`${publicBaseUrl(request)}/payment/failure?order=${encodeURIComponent(order.id)}`);
  }
  const base = publicBaseUrl(request);
  const { gatewayUrl, fields } = build3DHostFields({
    order,
    okUrl: `${base}/api/payments/qnbpay/callback`,
    failUrl: `${base}/api/payments/qnbpay/callback`,
    installment: attempt.installment,
  });
  const inputs = Object.entries(fields)
    .map(([name, value]) => `<input type="hidden" name="${escapeHtml(name)}" value="${escapeHtml(value)}" />`)
    .join('');
  const html = `<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>QNBpay 3D Host</title></head><body>
<p>QNBpay güvenli ödeme sayfasına yönlendiriliyorsunuz...</p>
<form id="qnb" method="post" action="${escapeHtml(gatewayUrl)}">${inputs}</form>
<script>document.getElementById('qnb').submit();</script>
</body></html>`;
  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
