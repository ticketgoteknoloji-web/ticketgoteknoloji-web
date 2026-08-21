#!/usr/bin/env node
/**
 * Generate DOWNLOAD_ADMIN_CODE_HASH for server env.
 * Usage: node scripts/hash-download-admin-code.mjs
 * Prompts for the admin code without echoing it back in the hash output.
 * Does not print the plaintext code — only the env assignment line.
 */
import { randomBytes, scryptSync } from 'node:crypto';
import { stdin, stdout } from 'node:process';

function readHidden(promptText) {
  return new Promise((resolve, reject) => {
    stdout.write(promptText);
    let value = '';
    const wasRaw = stdin.isRaw;
    if (stdin.isTTY) {
      try {
        stdin.setRawMode(true);
      } catch {
        // Fall through — input may still work without raw mode.
      }
    }
    stdin.resume();
    stdin.setEncoding('utf8');

    const cleanup = () => {
      stdin.off('data', onData);
      if (stdin.isTTY) {
        try {
          stdin.setRawMode(Boolean(wasRaw));
        } catch {
          /* ignore */
        }
      }
      stdin.pause();
    };

    const onData = (chunk) => {
      const chars = String(chunk);
      for (const char of chars) {
        if (char === '\n' || char === '\r' || char === '\u0004') {
          cleanup();
          stdout.write('\n');
          resolve(value);
          return;
        }
        if (char === '\u0003') {
          cleanup();
          stdout.write('\n');
          reject(new Error('Aborted'));
          return;
        }
        if (char === '\u007f' || char === '\b') {
          value = value.slice(0, -1);
          continue;
        }
        if (char < ' ' && char !== '\t') continue;
        value += char;
      }
    };

    stdin.on('data', onData);
  });
}

const code = await readHidden('Yönetici kodunu girin (gizli): ').catch(() => {
  process.exit(1);
});

if (!code || typeof code !== 'string') {
  console.error('Yönetici kodu boş olamaz.');
  process.exit(1);
}
if (code.length > 256) {
  console.error('Yönetici kodu çok uzun (maks. 256).');
  process.exit(1);
}

const salt = randomBytes(16).toString('hex');
const hash = scryptSync(code, salt, 64).toString('hex');
console.log(`DOWNLOAD_ADMIN_CODE_HASH=scrypt$${salt}$${hash}`);
