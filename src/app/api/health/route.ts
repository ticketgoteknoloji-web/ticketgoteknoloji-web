import { NextResponse } from 'next/server';
import { downloadsDataPath } from '@/lib/downloads/config';
import { ensureDownloadStorageWritable, resolveDownloadStorageDir } from '@/lib/downloads/storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Lightweight health probe — no secrets, no absolute internal paths.
 */
export async function GET() {
  let storage: 'ok' | 'error' = 'ok';
  try {
    await ensureDownloadStorageWritable();
  } catch {
    storage = 'error';
  }

  const status = storage === 'ok' ? 'ok' : 'degraded';
  return NextResponse.json(
    {
      status,
      checks: {
        app: 'ok',
        downloadStorage: storage,
        downloadMetadataConfigured: Boolean(downloadsDataPath()),
        downloadStorageConfigured: Boolean(resolveDownloadStorageDir()),
      },
    },
    {
      status: status === 'ok' ? 200 : 503,
      headers: { 'Cache-Control': 'no-store' },
    }
  );
}
