import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

describe('CreateUserIdentities migration', () => {
  const filePath = path.join(
    process.cwd(),
    'src',
    'migrations',
    '1788400000000-CreateUserIdentities.ts',
  );
  const source = () => readFileSync(filePath, 'utf8');

  it('creates the table once, tied to its user and removed with them', () => {
    expect(existsSync(filePath)).toBe(true);
    expect(source()).toContain('CREATE TABLE IF NOT EXISTS "user_identities"');
    expect(source()).toMatch(/REFERENCES "users"\("id"\) ON DELETE CASCADE/);
  });

  it('lets one provider account open one user only', () => {
    expect(source()).toMatch(
      /CREATE UNIQUE INDEX IF NOT EXISTS "UQ_user_identities_issuer_subject"\s+ON "user_identities" \("issuer", "subject"\)/,
    );
  });

  it('marks every existing account as having a password', () => {
    expect(source()).toContain(
      'ADD COLUMN IF NOT EXISTS "password_set" boolean NOT NULL DEFAULT true',
    );
  });

  it('undoes both on the way down', () => {
    expect(source()).toContain('DROP COLUMN IF EXISTS "password_set"');
    expect(source()).toContain('DROP TABLE IF EXISTS "user_identities"');
  });
});
