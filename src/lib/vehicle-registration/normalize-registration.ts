/**
 * Generic normalization helpers shared by plate/VIN/date fields.
 * These never silently "guess" an ambiguous OCR character — see
 * plate-validator.ts and vin-validator.ts for how ambiguity is surfaced
 * instead of resolved.
 */

export function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

/** Uppercases, strips separators (spaces/dashes), keeping only A-Z/0-9. Turkish İ → I. */
export function stripToAlnum(value: string): string {
  return value
    .toUpperCase()
    .replace(/İ/g, 'I')
    .replace(/[^A-Z0-9]/g, '');
}

/** Normalizes a DD.MM.YYYY / DD-MM-YYYY / DD/MM/YYYY date to ISO 8601, or null if unparseable. */
export function normalizeTurkishDate(raw: string | null): string | null {
  if (!raw) return null;
  const match = raw.trim().match(/^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})$/);
  if (!match) return null;
  const [, dd, mm, yyyy] = match;
  const day = Number(dd);
  const month = Number(mm);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const iso = `${yyyy}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return Number.isNaN(new Date(iso).getTime()) ? null : iso;
}
