import { NextResponse } from 'next/server';
import { DOWNLOAD_PAGE_SIZE } from '@/lib/downloads/config';
import { listPublicPackages } from '@/lib/downloads/store';
import { clientIp, rateLimit } from '@/lib/payments/security';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const ip = clientIp(request.headers);
  if (!rateLimit(`downloads-list:${ip}`, 60, 60_000)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }
  const packages = await listPublicPackages(DOWNLOAD_PAGE_SIZE);
  return NextResponse.json(
    { packages, pageSize: DOWNLOAD_PAGE_SIZE },
    { headers: { 'Cache-Control': 'private, no-store' } }
  );
}
