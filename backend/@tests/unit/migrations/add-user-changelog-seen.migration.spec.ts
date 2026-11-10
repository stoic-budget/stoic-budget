import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

describe('AddUserChangelogSeen migration', () => {
  const filePath = path.join(
    process.cwd(),
    'src',
    'migrations',
    '1788380000000-AddUserChangelogSeen.ts',
  );
  const source = () => readFileSync(filePath, 'utf8');

  it('adds both columns without a default, so existing accounts start at NULL', () => {
    expect(existsSync(filePath)).toBe(true);
    expect(source()).toContain(
      'ADD COLUMN IF NOT EXISTS "changelog_seen_id" character varying(80)\'',
    );
    expect(source()).toContain(
      'ADD COLUMN IF NOT EXISTS "changelog_seen_at" TIMESTAMP WITH TIME ZONE\'',
    );
  });

  it('starts new accounts at their sign-up time, after the column exists', () => {
    const text = source();
    const setDefault = text.indexOf('ALTER COLUMN "changelog_seen_at" SET DEFAULT now()');
    expect(setDefault).toBeGreaterThan(text.indexOf('"changelog_seen_at" TIMESTAMP WITH TIME ZONE'));
  });

  it('drops both columns on the way down', () => {
    expect(source()).toContain('DROP COLUMN IF EXISTS "changelog_seen_at"');
    expect(source()).toContain('DROP COLUMN IF EXISTS "changelog_seen_id"');
  });
});
