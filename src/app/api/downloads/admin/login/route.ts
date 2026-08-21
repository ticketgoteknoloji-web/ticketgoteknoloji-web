import { NextResponse } from 'next/server';
import {
  ADMIN_TTL_MS,
  adminCookieOptions,
  adminLoginAllowed,
  authenticateAdminCode,
  DOWNLOAD_ADMIN_COOKIE,
  encodeAdminSession,
} from '@/lib/downloads/auth';
import { DOWNLOAD_ADMIN_CODE_MAX_LENGTH } from '@/lib/downloads/config';
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

  let body: { code?: unknown };
  try {
    body = (await request.json()) as { code?: unknown };
  } catch {
    return NextResponse.json({ error: 'Yönetici kodu hatalı.' }, { status: 400 });
  }

  const code = typeof body.code === 'string' ? body.code : '';
  if (!code || code.length > DOWNLOAD_ADMIN_CODE_MAX_LENGTH) {
    paymentLog('download_admin_login_failed', { ip });
    return NextResponse.json({ error: 'Yönetici kodu hatalı.' }, { status: 401 });
  }

  const ok = authenticateAdminCode(code);
  if (!ok) {
    paymentLog('download_admin_login_failed', { ip });
    return NextResponse.json({ error: 'Yönetici kodu hatalı.' }, { status: 401 });
  }

  const token = encodeAdminSession();
  const response = NextResponse.json({ ok: true });
  response.cookies.set(DOWNLOAD_ADMIN_COOKIE, token, adminCookieOptions(Math.floor(ADMIN_TTL_MS / 1000)));
  paymentLog('download_admin_login_ok', { ip });
  return response;
}
