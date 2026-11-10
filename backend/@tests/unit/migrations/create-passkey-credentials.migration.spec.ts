import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

describe('CreatePasskeyCredentials migration', () => {
  const filePath = path.join(
    process.cwd(),
    'src',
    'migrations',
    '1788390000000-CreatePasskeyCredentials.ts',
  );
  const source = () => readFileSync(filePath, 'utf8');
  const up = () => source().slice(source().indexOf('public async up'), source().indexOf('public async down'));

  it('creates the table idempotently', () => {
    expect(existsSync(filePath)).toBe(true);
    expect(up()).toContain('CREATE TABLE IF NOT EXISTS "passkey_credentials"');
    expect(up()).toContain('CREATE UNIQUE INDEX IF NOT EXISTS "UQ_passkey_credentials_credential_id"');
    expect(up()).toContain('CREATE INDEX IF NOT EXISTS "IDX_passkey_credentials_user_id"');
  });

  it('removes a person’s passkeys with the person', () => {
    expect(up()).toMatch(/FOREIGN KEY \("user_id"\)\s+REFERENCES "users"\("id"\) ON DELETE CASCADE/);
  });

  it('has no workspace column, so workspace backups and versions leave passkeys out', () => {
    expect(up()).not.toContain('workspace_id');
  });

  it('keeps every column the sign-in checks', () => {
    for (const column of [
      'credential_id',
      'public_key',
      'sign_count',
      'transports',
      'backed_up',
      'device_type',
      'name',
      'created_at',
      'last_used_at',
    ]) {
      expect(up()).toContain(`"${column}"`);
    }
  });

  it('reverses itself', () => {
    expect(source().slice(source().indexOf('public async down'))).toContain(
      'DROP TABLE IF EXISTS "passkey_credentials"',
    );
  });
});
