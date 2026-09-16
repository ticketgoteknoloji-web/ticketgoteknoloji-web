import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

function isMrzHost(hostHeader: string | null | undefined): boolean {
  const host = (hostHeader ?? '').trim().toLowerCase();
  if (!host) return false;
  const [hostname, port] = host.split(':');
  if (hostname === 'mrz.ticketgoteknoloji.com') return true;
  if (port === '3011') return true;
  return false;
}

function buildCsp(isHttps: boolean): string {
  const directives = [
    "default-src 'self'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data: https://fonts.gstatic.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "connect-src 'self' https: wss: ws:",
    "form-action 'self' https://vpostest.qnb.com.tr https://vpos.qnb.com.tr https://app.sipay.com.tr https://panel.sipay.com.tr",
    "frame-src 'self' https://vpostest.qnb.com.tr https://vpos.qnb.com.tr https://app.sipay.com.tr https://panel.sipay.com.tr",
  ];
  if (isHttps) {
    directives.push('upgrade-insecure-requests');
  }
  return directives.join('; ');
}

export function middleware(request: NextRequest) {
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
  const mrz = isMrzHost(host);

  const response = NextResponse.next();
  const forwardedProto = request.headers.get('x-forwarded-proto');
  const isHttps = request.nextUrl.protocol === 'https:' || forwardedProto === 'https';

  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('X-DNS-Prefetch-Control', 'off');
  response.headers.set(
    'Permissions-Policy',
    mrz
      ? 'camera=(self), microphone=(), geolocation=(), payment=()'
      : 'camera=(), microphone=(), geolocation=(), payment=()',
  );
  response.headers.set('Content-Security-Policy', buildCsp(isHttps));

  if (!request.nextUrl.pathname.startsWith('/api/payments/')) {
    response.headers.set('X-Frame-Options', 'DENY');
  }
  if (request.nextUrl.pathname.startsWith('/api/payments')) {
    response.headers.set('Cache-Control', 'no-store');
  }
  if (request.nextUrl.pathname.startsWith('/api/downloads')) {
    response.headers.set('Cache-Control', 'no-store');
  }
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|brand/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|xml|txt)$).*)'],
};
