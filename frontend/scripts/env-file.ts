import { existsSync, readFileSync, writeFileSync } from 'node:fs';

// Minimal .env.local reader/writer that preserves comments and order and only touches given keys.

export const ENV_FILE = '.env.local';

export function readEnv(path = ENV_FILE): Record<string, string> {
  if (!existsSync(path)) return {};
  const values: Record<string, string> = {};
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (match) values[match[1]] = match[2];
  }
  return values;
}

export function writeEnv(updates: Record<string, string>, path = ENV_FILE): void {
  const lines = existsSync(path) ? readFileSync(path, 'utf8').split('\n') : [];
  const pending = new Map(Object.entries(updates));
  const next = lines.map((line) => {
    const match = /^([A-Z0-9_]+)=/.exec(line.trim());
    if (match && pending.has(match[1])) {
      const value = pending.get(match[1])!;
      pending.delete(match[1]);
      return `${match[1]}=${value}`;
    }
    return line;
  });
  if (pending.size) {
    if (next.length && next[next.length - 1] !== '') next.push('');
    for (const [key, value] of pending) next.push(`${key}=${value}`);
  }
  writeFileSync(path, next.join('\n').replace(/\n*$/, '\n'), { mode: 0o600 });
}
