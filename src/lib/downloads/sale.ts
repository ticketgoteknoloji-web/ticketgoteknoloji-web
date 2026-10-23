/**
 * Sales status is independent of price and file visibility.
 * Missing values on records written before this field stay open so existing
 * purchases keep their previous rule. New saves default to closed.
 */
export function legacySaleOpen(value: unknown): boolean {
  return typeof value === 'boolean' ? value : true;
}

export function saleOpenForSave(explicit: boolean | undefined, existing: boolean | undefined): boolean {
  if (typeof explicit === 'boolean') return explicit;
  if (typeof existing === 'boolean') return existing;
  return false;
}

/** Empty form value is Satışa Kapalı. Anything else must be an explicit choice. */
export function parseSaleStatusField(raw: string | null | undefined): boolean | 'invalid' {
  if (raw == null || raw.trim() === '') return false;
  const value = raw.trim().toLowerCase();
  if (value === 'closed' || value === 'false' || value === '0') return false;
  if (value === 'open' || value === 'true' || value === '1') return true;
  return 'invalid';
}

export function canPurchaseDownload(pkg: {
  priceUsd: number | null;
  saleOpen: boolean;
  published?: boolean;
}): boolean {
  return pkg.published !== false && pkg.saleOpen === true && pkg.priceUsd != null && pkg.priceUsd > 0;
}
