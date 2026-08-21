import { NextResponse } from 'next/server';
import {
  ADMIN_TTL_MS,
  adminCookieOptions,
  adminLoginAllowed,
  authenticateAdminCredentials,
  DOWNLOAD_ADMIN_COOKIE,
  encodeAdminSession,
} from '@/lib/downloads/auth';
import { clientIp, paymentLog } from '@/lib/payments/security';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const ip = clientIp(request.headers);
  if (!adminLoginAllowed(ip)) {
    return NextResponse.json(
      { error: 'Çok fazla başarısız deneme. Lütfen daha sonra tekrar deneyin.' },
      { status: 429 }
    );
  }

  let body: { email?: string; password?: string };
  try {
    body = (await request.json()) as { email?: string; password?: string };
  } catch {
    return NextResponse.json({ error: 'Kullanıcı adı veya şifre hatalı.' }, { status: 400 });
  }

  const email = typeof body.email === 'string' ? body.email : '';
  const password = typeof body.password === 'string' ? body.password : '';
  const ok = authenticateAdminCredentials(email, password);
  if (!ok) {
    paymentLog('download_admin_login_failed', { ip });
    return NextResponse.json({ error: 'Kullanıcı adı veya şifre hatalı.' }, { status: 401 });
  }

  const token = encodeAdminSession(email);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(DOWNLOAD_ADMIN_COOKIE, token, adminCookieOptions(Math.floor(ADMIN_TTL_MS / 1000)));
  paymentLog('download_admin_login_ok', { ip });
  return response;
}
