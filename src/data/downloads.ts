/**
 * Client-safe download catalog helpers.
 * Real package rows live in `.data/downloads.json` (server-only) after admin upload.
 * This module must not contain demo/fake product rows.
 */

export const DOWNLOAD_PAGE_SIZE = 20;

export type DownloadPlatformId = 'windows' | 'macos' | 'android' | 'ios';

export type DownloadPlatformFilter = 'all' | DownloadPlatformId | 'other';

export const DOWNLOAD_PLATFORM_IDS: readonly DownloadPlatformId[] = [
  'windows',
  'macos',
  'android',
  'ios',
] as const;

export const DOWNLOAD_PLATFORM_LABELS: Record<DownloadPlatformId, string> = {
  windows: 'Windows',
  macos: 'macOS',
  android: 'Android',
  ios: 'iOS',
};

export const DOWNLOAD_TABLE_FILTERS = [
  { id: 'all' as const, label: 'Tümü' },
  { id: 'windows' as const, label: 'Windows' },
  { id: 'macos' as const, label: 'macOS' },
  { id: 'android' as const, label: 'Android' },
  { id: 'ios' as const, label: 'iOS' },
];

export function isDownloadPlatformId(value: string): value is DownloadPlatformId {
  return (DOWNLOAD_PLATFORM_IDS as readonly string[]).includes(value);
}

/** Parse legacy single-label strings and Universal into platform ids. */
export function parsePlatformIds(input: unknown): DownloadPlatformId[] {
  if (Array.isArray(input)) {
    const ids = input
      .map((item) => String(item).trim().toLocaleLowerCase('en-US'))
      .filter(isDownloadPlatformId);
    return uniquePlatforms(ids);
  }

  const value = String(input ?? '')
    .trim()
    .toLocaleLowerCase('tr-TR');
  if (!value) return [];

  if (
    value === 'universal' ||
    value === 'all' ||
    value.includes('tüm') ||
    value.includes('tum') ||
    value.includes('hepsi')
  ) {
    return [...DOWNLOAD_PLATFORM_IDS];
  }

  const found: DownloadPlatformId[] = [];
  if (value.includes('windows') || value.includes('win')) found.push('windows');
  if (value.includes('mac')) found.push('macos');
  if (value.includes('android')) found.push('android');
  if (value.includes('ios') || value.includes('iphone') || value.includes('ipad')) found.push('ios');
  return uniquePlatforms(found);
}

export function uniquePlatforms(ids: readonly DownloadPlatformId[]): DownloadPlatformId[] {
  const order = DOWNLOAD_PLATFORM_IDS;
  return order.filter((id) => ids.includes(id));
}

export function formatPlatformLabels(platforms: readonly DownloadPlatformId[]): string {
  return platforms.map((id) => DOWNLOAD_PLATFORM_LABELS[id]).join(' · ');
}

export function formatShortDate(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return isoDate;
  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

export function formatReleaseDate(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return isoDate;
  return new Intl.DateTimeFormat('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

export function matchesPlatformFilter(
  platforms: readonly DownloadPlatformId[] | string | undefined,
  filter: DownloadPlatformFilter
): boolean {
  if (filter === 'all') return true;
  const ids = Array.isArray(platforms) ? uniquePlatforms(platforms) : parsePlatformIds(platforms);
  if (filter === 'other') {
    return ids.length === 0;
  }
  return ids.includes(filter);
}
