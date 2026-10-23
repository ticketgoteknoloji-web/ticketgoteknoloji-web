/**
 * Tami 3D Secure form targets.
 * Official sale pages name these API origins and return the challenge HTML from them.
 * Sandbox and production stay separate. Portal hosts are not challenge targets.
 * https://dev.tami.com.tr/tami-satis-islemi-3dli
 * https://dev.tami.com.tr/en/virtualpos-sales-cash-with3d
 */
export const TAMI_3DS_ORIGINS = {
  sandbox: 'https://sandbox-paymentapi.tami.com.tr',
  production: 'https://paymentapi.tami.com.tr',
} as const;

export const QNB_SIPAY_FORM_ORIGINS = [
  'https://vpostest.qnb.com.tr',
  'https://vpos.qnb.com.tr',
  'https://app.sipay.com.tr',
  'https://panel.sipay.com.tr',
] as const;

export type Tami3dsEnv = keyof typeof TAMI_3DS_ORIGINS;

export type Tami3dsHtmlDecision =
  | { ok: true; origin: string }
  | { ok: false; reason: 'missing_form' | 'insecure_target' | 'unverified_origin' };

export function tami3dsEnv(value: string | undefined): Tami3dsEnv {
  const raw = (value ?? '').trim().toLowerCase();
  return raw === 'production' || raw === 'prod' || raw === 'live' ? 'production' : 'sandbox';
}

export function tami3dsOrigin(env: Tami3dsEnv): string {
  return TAMI_3DS_ORIGINS[env];
}

/** API base stays on the verified origin. An undocumented host is ignored. */
export function tamiApiBase(env: Tami3dsEnv, configured: string | undefined): string {
  const expected = tami3dsOrigin(env);
  const raw = (configured ?? '').trim();
  if (!raw) return expected;
  try {
    const url = new URL(raw);
    if (url.protocol === 'https:' && url.origin === expected && !url.username && !url.password && !url.search && !url.hash) {
      const path = url.pathname.replace(/\/$/, '');
      return path && path !== '/' ? `${expected}${path}` : expected;
    }
  } catch {
    /* unverified override */
  }
  return expected;
}

export function formActionDirective(env: Tami3dsEnv): string {
  return `form-action 'self' ${QNB_SIPAY_FORM_ORIGINS.join(' ')} ${tami3dsOrigin(env)}`;
}

function readAttr(tag: string, name: string): string[] {
  const found: string[] = [];
  const pattern = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'gi');
  for (const match of tag.matchAll(pattern)) {
    found.push(match[1] ?? match[2] ?? match[3] ?? '');
  }
  return found;
}

export function inspectTami3dsHtml(html: string, env: Tami3dsEnv): Tami3dsHtmlDecision {
  const expected = tami3dsOrigin(env);
  const forms = html.match(/<form\b[^>]*>/gi) ?? [];
  if (forms.length === 0) return { ok: false, reason: 'missing_form' };
  const actions = forms.flatMap((tag) => readAttr(tag, 'action'));
  const buttonTargets = readAttr(html, 'formaction');
  const refreshTargets = metaRefreshTargets(html);
  if (actions.length === 0) return { ok: false, reason: 'missing_form' };
  for (const action of [...actions, ...buttonTargets, ...refreshTargets]) {
    const verdict = classifyFormAction(action, expected);
    if (verdict !== 'ok') return { ok: false, reason: verdict };
  }
  return { ok: true, origin: expected };
}

function metaRefreshTargets(html: string): string[] {
  const tags = html.match(/<meta\b[^>]*>/gi) ?? [];
  const targets: string[] = [];
  for (const tag of tags) {
    if (!readAttr(tag, 'http-equiv').some((value) => /refresh/i.test(value))) continue;
    for (const content of readAttr(tag, 'content')) {
      const match = content.match(/url\s*=\s*(.*)$/i);
      if (!match) continue;
      targets.push(match[1].trim().replace(/^['"]|['"]$/g, ''));
    }
  }
  return targets;
}

function classifyFormAction(action: string, expectedOrigin: string): 'ok' | 'insecure_target' | 'unverified_origin' {
  const trimmed = action.trim();
  if (!trimmed || /^javascript:/i.test(trimmed) || /^data:/i.test(trimmed) || trimmed.startsWith('//')) {
    return 'insecure_target';
  }
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return 'unverified_origin';
  }
  if (url.protocol !== 'https:' || url.username || url.password) return 'insecure_target';
  if (url.origin !== expectedOrigin) return 'unverified_origin';
  return 'ok';
}
