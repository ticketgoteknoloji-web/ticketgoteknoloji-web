#!/usr/bin/env node
/**
 * Generate DOWNLOAD_ADMIN_PASSWORD_HASH for .env.local
 * Usage: node scripts/hash-download-admin-password.mjs "your-password"
 * Does not print the password back — only the hash line.
 */
import { randomBytes, scryptSync } from 'node:crypto';

const password = process.argv[2];
if (!password) {
  console.error('Usage: node scripts/hash-download-admin-password.mjs "<password>"');
  process.exit(1);
}

const salt = randomBytes(16).toString('hex');
const hash = scryptSync(password, salt, 64).toString('hex');
console.log(`DOWNLOAD_ADMIN_PASSWORD_HASH=scrypt$${salt}$${hash}`);
