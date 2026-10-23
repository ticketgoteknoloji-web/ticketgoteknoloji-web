import { registerHooks } from 'node:module';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function resolveExisting(base) {
  if (existsSync(base) && statSync(base).isFile()) return pathToFileURL(base).href;
  if (existsSync(base) && statSync(base).isDirectory()) {
    for (const index of ['index.ts', 'index.tsx', 'index.js']) {
      const candidate = join(base, index);
      if (existsSync(candidate)) return pathToFileURL(candidate).href;
    }
  }
  for (const ext of ['.ts', '.tsx', '.js', '.mjs', '.json']) {
    if (existsSync(base + ext)) return pathToFileURL(base + ext).href;
  }
  return null;
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'server-only') {
      return { url: 'data:text/javascript,export default {}', shortCircuit: true };
    }
    let base = null;
    if (specifier.startsWith('@/')) base = join(root, 'src', specifier.slice(2));
    else if ((specifier.startsWith('./') || specifier.startsWith('../')) && context.parentURL?.startsWith('file:')) {
      base = fileURLToPath(new URL(specifier, context.parentURL));
    }
    if (base) {
      const url = resolveExisting(base);
      if (url) return { url, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url.endsWith('.json')) {
      return { format: 'json', source: readFileSync(new URL(url), 'utf8'), shortCircuit: true };
    }
    return nextLoad(url, context);
  },
});
