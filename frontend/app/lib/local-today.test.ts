import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { localToday } from './local-today';

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Greenwich's day passed off as today.
const UTC_TODAY =
  /new Date\((?:Date\.now\(\))?\)\s*\.\s*(?:toISOString|toJSON)\(\)\s*\.\s*(?:slice\(0,\s*10\)|substr(?:ing)?\(0,\s*10\)|split\(\s*'T'[^)]*\)\[0\])/;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'node_modules' ? [] : sourceFiles(full);
    return /\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

describe('localToday', () => {
  it("is the person's day just after midnight, not Greenwich's", () => {
    // Pinned zones: in a UTC runner the person's day and Greenwich's are the same.
    const zone = process.env.TZ;
    try {
      process.env.TZ = 'Europe/Berlin';
      expect(localToday(new Date('2026-02-28T23:30:00Z'))).toBe('2026-03-01');
      process.env.TZ = 'America/New_York';
      expect(localToday(new Date('2026-03-01T01:00:00Z'))).toBe('2026-02-28');
    } finally {
      process.env.TZ = zone;
    }
  });

  it('is the only way the app takes today', () => {
    const offenders = sourceFiles(APP)
      .filter(file => !/local-today(\.test)?\.ts$/.test(file))
      .filter(file => UTC_TODAY.test(readFileSync(file, 'utf8')))
      .map(file => path.relative(APP, file));
    expect(offenders).toEqual([]);
  });
});
