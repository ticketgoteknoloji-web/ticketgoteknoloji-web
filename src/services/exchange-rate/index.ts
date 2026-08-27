import { mkdir, readFile, writeFile } from 'fs/promises';
import path from 'path';
import { USD_TRY_REFRESH_MS } from '@/lib/fx/refresh';
import type { UsdTryQuote, UsdTryQuoteStatus } from '@/lib/fx/types';
import { fetchTcmbUsdSelling, type TcmbUsdQuote } from '@/services/exchange-rate/tcmb';

export type { UsdTryQuote, UsdTryQuoteStatus } from '@/lib/fx/types';

const CACHE_TTL_MS = USD_TRY_REFRESH_MS;
const CACHE_FILE = path.join(process.cwd(), '.data', 'tcmb-usd-try.json');

type StoredQuote = {
  rate: number;
  date: string;
  fetchedAt: string;
};

let memory: { quote: StoredQuote; storedAt: number } | null = null;
let inflight: Promise<UsdTryQuote> | null = null;

function toPublic(stored: StoredQuote, status: Exclude<UsdTryQuoteStatus, 'UNAVAILABLE'>): UsdTryQuote {
  return {
    base: 'USD',
    quote: 'TRY',
    rate: stored.rate,
    source: 'TCMB',
    rateType: 'ForexSelling',
    date: stored.date,
    updatedAt: stored.fetchedAt,
    status,
  };
}

function unavailable(): UsdTryQuote {
  return {
    base: 'USD',
    quote: 'TRY',
    rate: null,
    source: 'TCMB',
    rateType: 'ForexSelling',
    date: null,
    updatedAt: null,
    status: 'UNAVAILABLE',
  };
}

function isFresh(storedAt: number): boolean {
  return Date.now() - storedAt < CACHE_TTL_MS;
}

async function readDisk(): Promise<StoredQuote | null> {
  try {
    const raw = await readFile(CACHE_FILE, 'utf8');
    const parsed = JSON.parse(raw) as Partial<StoredQuote>;
    if (typeof parsed.rate === 'number' && parsed.rate > 0 && parsed.date && parsed.fetchedAt) {
      return { rate: parsed.rate, date: parsed.date, fetchedAt: parsed.fetchedAt };
    }
  } catch {
    /* missing or unreadable */
  }
  return null;
}

async function writeDisk(quote: StoredQuote): Promise<void> {
  try {
    await mkdir(path.dirname(CACHE_FILE), { recursive: true });
    await writeFile(CACHE_FILE, JSON.stringify(quote), 'utf8');
  } catch {
    /* cache write is best-effort */
  }
}

function fromTcmb(live: TcmbUsdQuote): StoredQuote {
  return { rate: live.rate, date: live.date, fetchedAt: live.fetchedAt };
}

async function resolveQuote(): Promise<UsdTryQuote> {
  if (memory && isFresh(memory.storedAt)) {
    return toPublic(memory.quote, 'LIVE');
  }

  try {
    const live = fromTcmb(await fetchTcmbUsdSelling());
    memory = { quote: live, storedAt: Date.now() };
    await writeDisk(live);
    return toPublic(live, 'LIVE');
  } catch {
    const fallback = memory?.quote ?? (await readDisk());
    if (fallback) {
      memory = { quote: fallback, storedAt: memory?.storedAt ?? 0 };
      return toPublic(fallback, 'CACHED');
    }
    return unavailable();
  }
}

export async function getUsdTryQuote(): Promise<UsdTryQuote> {
  if (inflight) return inflight;
  inflight = resolveQuote().finally(() => {
    inflight = null;
  });
  return inflight;
}

export async function getUsdTryRate(): Promise<TcmbUsdQuote | null> {
  const quote = await getUsdTryQuote();
  if (quote.rate == null || !quote.date || !quote.updatedAt) return null;
  return {
    currency: 'USD',
    rate: quote.rate,
    source: 'TCMB',
    rateType: 'ForexSelling',
    date: quote.date,
    fetchedAt: quote.updatedAt,
  };
}

/** Test helpers — not used in production request paths. */
export function resetUsdTryCacheForTests(): void {
  memory = null;
  inflight = null;
}

export function seedUsdTryCacheForTests(quote: StoredQuote, storedAt = Date.now()): void {
  memory = { quote, storedAt };
}
