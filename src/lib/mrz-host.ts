export function isMrzHost(hostHeader: string | null | undefined): boolean {
  const host = (hostHeader ?? '').trim().toLowerCase();
  if (!host) return false;
  const [hostname, port] = host.split(':');
  if (hostname === 'mrz.ticketgoteknoloji.com') return true;
  if (port === '3011') return true;
  return false;
}
