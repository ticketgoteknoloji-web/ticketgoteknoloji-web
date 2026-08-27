export const TCMB_TODAY_URL = 'https://www.tcmb.gov.tr/kurlar/today.xml';

export type TcmbUsdQuote = {
  currency: 'USD';
  rate: number;
  source: 'TCMB';
  rateType: 'ForexSelling';
  date: string;
  fetchedAt: string;
};

function xmlTag(block: string, tag: string): string {
  const match = new RegExp(`<${tag}>([^<]*)</${tag}>`, 'i').exec(block);
  return match?.[1]?.trim() ?? '';
}

function parseTcmbDate(xml: string): string {
  const iso = /\bDate="(\d{2})\/(\d{2})\/(\d{4})"/.exec(xml);
  if (iso) return `${iso[3]}-${iso[1]}-${iso[2]}`;
  const tr = /\bTarih="(\d{2})\.(\d{2})\.(\d{4})"/.exec(xml);
  if (tr) return `${tr[3]}-${tr[2]}-${tr[1]}`;
  return new Date().toISOString().slice(0, 10);
}

function parseNumber(raw: string): number {
  const normalized = raw.replace(/\s/g, '').replace(',', '.');
  const value = Number(normalized);
  return Number.isFinite(value) ? value : NaN;
}

/** Parse TCMB today.xml and return USD ForexSelling (satış) divided by Unit. */
export function parseTcmbUsdSelling(xml: string): TcmbUsdQuote {
  if (!xml || !xml.includes('<Currency')) {
    throw new Error('tcmb_invalid_xml');
  }
  const usdBlock = /<Currency\b[^>]*CurrencyCode="USD"[^>]*>([\s\S]*?)<\/Currency>/i.exec(xml)?.[1];
  if (!usdBlock) throw new Error('tcmb_usd_not_found');
  return fromUsdBlock(usdBlock, xml);
}

function fromUsdBlock(block: string, xml: string): TcmbUsdQuote {
  const unit = parseNumber(xmlTag(block, 'Unit')) || 1;
  const selling = parseNumber(xmlTag(block, 'ForexSelling'));
  if (!Number.isFinite(selling) || selling <= 0) {
    throw new Error('tcmb_forex_selling_missing');
  }
  const rate = Number((selling / unit).toFixed(6));
  if (rate <= 0) throw new Error('tcmb_invalid_rate');
  return {
    currency: 'USD',
    rate,
    source: 'TCMB',
    rateType: 'ForexSelling',
    date: parseTcmbDate(xml),
    fetchedAt: new Date().toISOString(),
  };
}

export async function fetchTcmbUsdSelling(fetcher: typeof fetch = fetch): Promise<TcmbUsdQuote> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetcher(TCMB_TODAY_URL, {
      method: 'GET',
      headers: {
        Accept: 'application/xml, text/xml, */*',
        'User-Agent': 'TicketGoTeknoloji/1.0 (TCMB exchange-rate)',
      },
      cache: 'no-store',
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`tcmb_http_${response.status}`);
    }
    const xml = await response.text();
    return parseTcmbUsdSelling(xml);
  } finally {
    clearTimeout(timer);
  }
}
