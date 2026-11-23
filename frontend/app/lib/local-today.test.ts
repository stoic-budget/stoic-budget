import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { localToday } from './local-today';

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Greenwich's day passed off as today.
const UTC_TODAY = /new Date\(\)\.toISOString\(\)\.(?:slice\(0, ?10\)|split\('T'\)\[0\]|substring\(0, ?10\))/;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'node_modules' ? [] : sourceFiles(full);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

describe('localToday', () => {
  it("is the person's day just after midnight, not Greenwich's", () => {
    expect(localToday(new Date(2026, 2, 1, 0, 30))).toBe('2026-03-01');
    expect(localToday(new Date(2026, 1, 28, 23, 30))).toBe('2026-02-28');
  });

  it('is the only way the app takes today', () => {
    const offenders = sourceFiles(APP)
      .filter(file => !file.endsWith(`${path.sep}local-today.ts`))
      .filter(file => UTC_TODAY.test(readFileSync(file, 'utf8')))
      .map(file => path.relative(APP, file));
    expect(offenders).toEqual([]);
  });
});
