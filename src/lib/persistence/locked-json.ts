import { randomBytes } from 'crypto';
import { mkdir, open, readFile, rename, rm, stat, writeFile } from 'fs/promises';
import path from 'path';

const STALE_MS = 30_000;
const LOCK_WAIT_MS = 8_000;

export class DataFileError extends Error {
  readonly code: 'path_not_absolute' | 'unreadable' | 'invalid' | 'lock_timeout';

  constructor(code: DataFileError['code'], message: string) {
    super(message);
    this.name = 'DataFileError';
    this.code = code;
  }
}

export function resolveAbsoluteDataFile(envValue: string | undefined, fallbackAbsolute: string): string {
  const raw = envValue?.trim() ?? '';
  if (!raw) return fallbackAbsolute;
  if (!path.isAbsolute(raw)) {
    throw new DataFileError('path_not_absolute', 'Data file path must be absolute');
  }
  return path.resolve(raw);
}

function isErrno(error: unknown, code: string): boolean {
  return Boolean(error && typeof error === 'object' && 'code' in error && (error as { code?: string }).code === code);
}

export async function readJsonFile(file: string): Promise<{ missing: true } | { missing: false; value: unknown }> {
  let raw: string;
  try {
    raw = await readFile(file, 'utf8');
  } catch (error) {
    if (isErrno(error, 'ENOENT')) return { missing: true };
    throw new DataFileError('unreadable', 'Data file cannot be read');
  }
  if (!raw.trim()) throw new DataFileError('invalid', 'Data file is empty');
  try {
    return { missing: false, value: JSON.parse(raw) as unknown };
  } catch {
    throw new DataFileError('invalid', 'Data file is not valid JSON');
  }
}

function lockDir(file: string): string {
  return `${file}.lock`;
}

function isPidAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function lockIsStale(dir: string): Promise<boolean> {
  try {
    const info = await stat(dir);
    const age = Date.now() - info.mtimeMs;
    let pid = 0;
    try {
      pid = Number((await readFile(path.join(dir, 'owner'), 'utf8')).trim().split(/\s/)[0]);
    } catch {
      pid = 0;
    }
    if (isPidAlive(pid) && age < STALE_MS) return false;
    if (!isPidAlive(pid) && age > 1_000) return true;
    return age > STALE_MS;
  } catch (error) {
    if (isErrno(error, 'ENOENT')) return false;
    return false;
  }
}

async function acquire(file: string): Promise<void> {
  const dir = lockDir(file);
  const started = Date.now();
  for (;;) {
    try {
      await mkdir(dir);
      try {
        await writeFile(path.join(dir, 'owner'), `${process.pid}\n`);
      } catch (error) {
        await rm(dir, { recursive: true, force: true });
        throw error;
      }
      return;
    } catch (error) {
      if (error instanceof DataFileError) throw error;
      if (!isErrno(error, 'EEXIST')) {
        throw new DataFileError('unreadable', 'Data lock cannot be created');
      }
      if (await lockIsStale(dir)) {
        const stolen = `${dir}.stale-${process.pid}-${randomBytes(3).toString('hex')}`;
        try {
          await rename(dir, stolen);
          await rm(stolen, { recursive: true, force: true });
        } catch {
          /* another process released or claimed the lock */
        }
        continue;
      }
      if (Date.now() - started > LOCK_WAIT_MS) {
        throw new DataFileError('lock_timeout', 'Data file lock timed out');
      }
      await new Promise((resolve) => setTimeout(resolve, 15 + Math.floor(Math.random() * 40)));
    }
  }
}

async function release(file: string): Promise<void> {
  const dir = lockDir(file);
  try {
    const pid = Number((await readFile(path.join(dir, 'owner'), 'utf8')).trim().split(/\s/)[0]);
    if (pid !== process.pid) return;
  } catch {
    return;
  }
  await rm(dir, { recursive: true, force: true });
}

export async function withLockedUpdate<T>(file: string, work: () => Promise<T>): Promise<T> {
  try {
    await mkdir(path.dirname(file), { recursive: true });
  } catch (error) {
    if (isErrno(error, 'EACCES') || isErrno(error, 'EPERM')) {
      throw new DataFileError('unreadable', 'Data directory cannot be written');
    }
    throw error;
  }
  await acquire(file);
  try {
    return await work();
  } finally {
    await release(file);
  }
}

export async function writeJsonAtomic(file: string, value: unknown): Promise<void> {
  const dir = path.dirname(file);
  await mkdir(dir, { recursive: true });
  const tmp = `${file}.${process.pid}.${randomBytes(4).toString('hex')}.tmp`;
  const handle = await open(tmp, 'w');
  try {
    await handle.writeFile(JSON.stringify(value, null, 2), 'utf8');
    await handle.sync();
  } catch (error) {
    await handle.close();
    await rm(tmp, { force: true });
    throw error;
  }
  await handle.close();
  try {
    await rename(tmp, file);
  } catch (error) {
    await rm(tmp, { force: true });
    throw error;
  }
  try {
    const directory = await open(dir, 'r');
    try {
      await directory.sync();
    } finally {
      await directory.close();
    }
  } catch {
    /* directory sync is best-effort across platforms */
  }
}
