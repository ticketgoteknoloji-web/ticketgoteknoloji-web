import { NextResponse } from 'next/server';
import { adminCookieOptions, DOWNLOAD_ADMIN_COOKIE } from '@/lib/downloads/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(DOWNLOAD_ADMIN_COOKIE, '', { ...adminCookieOptions(0), maxAge: 0 });
  return response;
}
