/**
 * Safe download URL helpers for TicketGo Teknoloji Download Center.
 * Only allow explicitly trusted HTTPS hosts (or same-site relative paths).
 */

const TRUSTED_DOWNLOAD_HOSTS = new Set([
  'www.ticketgoteknoloji.com',
  'ticketgoteknoloji.com',
  'cdn.ticketgoteknoloji.com',
  'downloads.ticketgoteknoloji.com',
]);

export function isSafeDownloadUrl(raw: string | null | undefined): raw is string {
  if (!raw || typeof raw !== 'string') return false;
  const value = raw.trim();
  if (!value) return false;
  if (/^\s*javascript\s*:/i.test(value)) return false;
  if (/^\s*data\s*:/i.test(value)) return false;
  if (/^\s*vbscript\s*:/i.test(value)) return false;

  // Same-site relative path under /downloads/
  if (value.startsWith('/') && !value.startsWith('//')) {
    return value.startsWith('/downloads/');
  }

  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return false;
    const host = url.hostname.toLowerCase();
    return TRUSTED_DOWNLOAD_HOSTS.has(host);
  } catch {
    return false;
  }
}

export function toSafeDownloadHref(raw: string | null | undefined): string | null {
  return isSafeDownloadUrl(raw) ? raw.trim() : null;
}
