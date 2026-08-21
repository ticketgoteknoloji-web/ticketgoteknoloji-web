import { NextResponse } from 'next/server';
import { readAdminSession } from '@/lib/downloads/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await readAdminSession();
  if (!session) {
    return NextResponse.json({ authenticated: false }, { headers: { 'Cache-Control': 'private, no-store' } });
  }
  return NextResponse.json(
    { authenticated: true, email: session.email, exp: session.exp },
    { headers: { 'Cache-Control': 'private, no-store' } }
  );
}
