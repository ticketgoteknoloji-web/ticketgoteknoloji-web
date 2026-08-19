/**
 * Builds a safe `mailto:` href with properly encoded subject and body.
 * Never include sensitive data (card numbers, CVV, passwords) in subject or body.
 */
export function createMailto({
  to,
  subject,
  body,
}: {
  to: string;
  subject: string;
  body?: string;
}): string {
  const params = new URLSearchParams();
  params.set('subject', subject);
  if (body) params.set('body', body);
  // URLSearchParams uses + for spaces; mailto needs %20
  return `mailto:${to}?${params.toString().replace(/\+/g, '%20')}`;
}

/**
 * Builds a standard info-request body template.
 */
export function infoRequestBody(moduleName: string, contextLine?: string): string {
  const context = contextLine ? `${contextLine}\n` : '';
  return `Merhaba TicketGo Teknoloji Ekibi,\n\n${moduleName} hakkında bilgi almak istiyorum.\n\n${context}\nTalebim:\n`;
}

/**
 * Builds a wa.me link with a pre-filled message.
 * Returns null when phone is empty — callers should suppress the button entirely.
 * Never include sensitive data (card numbers, CVV, passwords) in the message.
 */
export function createWhatsAppLink({
  phone,
  message,
}: {
  phone: string;
  message: string;
}): string | null {
  const clean = phone.replace(/\D/g, '');
  if (!clean) return null;
  return `https://wa.me/${clean}?text=${encodeURIComponent(message)}`;
}
