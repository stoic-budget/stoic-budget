import { readFileSync } from 'node:fs';
import path from 'node:path';

describe('AddMcpOAuthCodeTokenVersion migration', () => {
  const source = readFileSync(
    path.join(process.cwd(), 'src', 'migrations', '1788331000000-AddMcpOAuthCodeTokenVersion.ts'),
    'utf8',
  );
  const up = source.slice(source.indexOf('public async up'), source.indexOf('public async down'));
  const down = source.slice(source.indexOf('public async down'));

  it('adds the session token version to codes idempotently, with a default for live rows', () => {
    expect(up).toContain(
      'ALTER TABLE "mcp_oauth_codes" ADD COLUMN IF NOT EXISTS "token_version" integer NOT NULL DEFAULT 0',
    );
    expect(down).toContain('ALTER TABLE "mcp_oauth_codes" DROP COLUMN IF EXISTS "token_version"');
  });
});
