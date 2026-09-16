import 'server-only';

import { randomUUID } from 'crypto';

export const IDENTITY_VERIFY_TIMEOUT_MS = 150_000;
export const IDENTITY_MAX_FILE_BYTES = 8 * 1024 * 1024;

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
const ALLOWED_EXT = /\.(jpe?g|png|webp)$/i;
const BLOCKED_SESSION_IDS = new Set(['', ':sessionid', 'sessionid']);

export type IdentityErrorCode =
  | 'INVALID_INPUT'
  | 'NOT_CONFIGURED'
  | 'MRZ_SERVICE_ERROR'
  | 'PAYLOAD_TOO_LARGE';

export type IdentityClientError = {
  success: false;
  verified: false;
  status: 'ERROR';
  errorCode: IdentityErrorCode;
  sessionId?: string;
};

export function identityError(errorCode: IdentityErrorCode, sessionId?: string): IdentityClientError {
  return {
    success: false,
    verified: false,
    status: 'ERROR',
    errorCode,
    ...(sessionId ? { sessionId } : {}),
  };
}

export function identityConfig(): { baseUrl: string; apiKey: string } | null {
  const baseUrl = (process.env.N8N_IDENTITY_VERIFY_BASE_URL ?? '').trim().replace(/\/+$/, '');
  const apiKey = (process.env.N8N_TICKETGO_API_KEY ?? '').trim();
  if (!baseUrl || !apiKey) return null;
  return { baseUrl, apiKey };
}

export function resolveSessionId(raw: unknown): string {
  const value = typeof raw === 'string' ? raw.trim() : '';
  if (!value || BLOCKED_SESSION_IDS.has(value.toLowerCase())) {
    return randomUUID();
  }
  if (!/^[A-Za-z0-9._-]{8,128}$/.test(value)) {
    return randomUUID();
  }
  return value;
}

export function validateIdentityFile(file: File | null): IdentityErrorCode | null {
  if (!file || typeof file.size !== 'number' || file.size <= 0) return 'INVALID_INPUT';
  if (file.size > IDENTITY_MAX_FILE_BYTES) return 'PAYLOAD_TOO_LARGE';
  const mime = (file.type || '').toLowerCase();
  const name = file.name || '';
  const mimeOk = !mime || ALLOWED_MIME.has(mime);
  const extOk = ALLOWED_EXT.test(name) || ALLOWED_MIME.has(mime);
  if (!mimeOk || !extOk) return 'INVALID_INPUT';
  return null;
}

export function identityLog(
  sessionId: string,
  fields: { httpStatus?: number; ms?: number; success?: unknown; status?: unknown },
): void {
  console.info(
    JSON.stringify({
      event: 'identity_verify',
      ts: new Date().toISOString(),
      sessionId,
      httpStatus: fields.httpStatus,
      ms: fields.ms,
      success: fields.success,
      status: fields.status,
    }),
  );
}

function looksLikeHtml(text: string): boolean {
  const s = text.trim().slice(0, 64).toLowerCase();
  return s.startsWith('<!doctype') || s.startsWith('<html') || s.startsWith('<head');
}

export async function forwardIdentityToN8n(options: {
  sessionId: string;
  file: File;
  documentHint: string;
}): Promise<{ httpStatus: number; body: unknown; ms: number }> {
  const cfg = identityConfig();
  if (!cfg) {
    return {
      httpStatus: 503,
      body: identityError('NOT_CONFIGURED', options.sessionId),
      ms: 0,
    };
  }

  const hint = options.documentHint.trim() || 'passport';
  const outbound = new FormData();
  outbound.append('dosya', options.file, options.file.name || 'document.jpg');
  outbound.append('document_hint', hint);

  const t0 = Date.now();
  try {
    const response = await fetch(`${cfg.baseUrl}/${encodeURIComponent(options.sessionId)}`, {
      method: 'POST',
      headers: {
        'x-ticketgo-api-key': cfg.apiKey,
      },
      body: outbound,
      signal: AbortSignal.timeout(IDENTITY_VERIFY_TIMEOUT_MS),
      redirect: 'manual',
      duplex: 'half',
    } as RequestInit);

    const ms = Date.now() - t0;
    const text = await response.text();
    const trimmed = text.trim();

    if (!trimmed || looksLikeHtml(trimmed)) {
      return {
        httpStatus: response.status >= 400 ? response.status : 502,
        body: identityError('MRZ_SERVICE_ERROR', options.sessionId),
        ms,
      };
    }

    try {
      const json: unknown = JSON.parse(trimmed);
      return { httpStatus: response.status, body: json, ms };
    } catch {
      return {
        httpStatus: response.status >= 400 ? response.status : 502,
        body: identityError('MRZ_SERVICE_ERROR', options.sessionId),
        ms,
      };
    }
  } catch {
    return {
      httpStatus: 502,
      body: identityError('MRZ_SERVICE_ERROR', options.sessionId),
      ms: Date.now() - t0,
    };
  }
}

export function mapUpstreamStatus(n8nStatus: number): number {
  if (n8nStatus === 401 || n8nStatus === 403) return 502;
  if (n8nStatus === 400) return 400;
  if (n8nStatus > 0) return n8nStatus;
  return 502;
}
