import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

function sipayKey(appSecret: string, salt: string): Buffer {
  const password = createHash('sha1').update(appSecret).digest('hex');
  return Buffer.from(createHash('sha256').update(password + salt).digest('hex').slice(0, 32), 'utf8');
}

/** Official Sipay hash: AES-256-CBC of joined parts, key = sha256(sha1(app_secret)+salt).hex[:32] */
export function sipayHashKey(parts: Array<string | number>, appSecret: string): string {
  const data = parts.map((part) => String(part)).join('|');
  const iv = createHash('sha1').update(randomBytes(16)).digest('hex').slice(0, 16);
  const salt = createHash('sha1').update(randomBytes(16)).digest('hex').slice(0, 4);
  const cipher = createCipheriv('aes-256-cbc', sipayKey(appSecret, salt), Buffer.from(iv, 'utf8'));
  const encrypted = Buffer.concat([cipher.update(data, 'utf8'), cipher.final()]).toString('base64');
  return `${iv}:${salt}:${encrypted}`.replaceAll('/', '__');
}

export function sipayDecryptHash(hashKey: string, appSecret: string): string | null {
  try {
    const normalized = decodeURIComponent(hashKey).replaceAll('__', '/');
    const [iv, salt, encrypted] = normalized.split(':');
    if (!iv || !salt || !encrypted) return null;
    const decipher = createDecipheriv('aes-256-cbc', sipayKey(appSecret, salt), Buffer.from(iv, 'utf8'));
    return Buffer.concat([decipher.update(Buffer.from(encrypted, 'base64')), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}
