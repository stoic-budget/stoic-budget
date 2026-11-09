import { readFileSync } from 'node:fs';
import path from 'node:path';

describe('CreateMcpOAuth migration', () => {
  const source = readFileSync(
    path.join(process.cwd(), 'src', 'migrations', '1788330000000-CreateMcpOAuth.ts'),
    'utf8',
  );
  const up = source.slice(source.indexOf('public async up'), source.indexOf('public async down'));
  const down = source.slice(source.indexOf('public async down'));

  it('creates the four tables idempotently', () => {
    for (const table of ['mcp_oauth_clients', 'mcp_oauth_grants', 'mcp_oauth_codes', 'mcp_oauth_tokens']) {
      expect(up).toContain(`CREATE TABLE IF NOT EXISTS "${table}"`);
      expect(down).toContain(`DROP TABLE IF EXISTS "${table}"`);
    }
  });

  it('stores codes and tokens only as unique 64-character hashes', () => {
    expect(up).toContain('"code_hash" varchar(64) NOT NULL');
    expect(up).toContain('"token_hash" varchar(64) NOT NULL');
    expect(up).toContain('CONSTRAINT "UQ_mcp_oauth_codes_hash" UNIQUE ("code_hash")');
    expect(up).toContain('CONSTRAINT "UQ_mcp_oauth_tokens_hash" UNIQUE ("token_hash")');
    expect(up).not.toMatch(/"(code|token|access_token|refresh_token)" (text|varchar)/);
  });

  it('ends grants and codes with the membership, the workspace and the user', () => {
    const cascades = [
      '"workspace_id" uuid NOT NULL REFERENCES "workspaces" ("id") ON DELETE CASCADE',
      '"workspace_member_id" uuid NOT NULL REFERENCES "workspace_members" ("id") ON DELETE CASCADE',
      '"user_id" uuid NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE',
    ];
    for (const table of ['mcp_oauth_grants', 'mcp_oauth_codes']) {
      const body = up.slice(up.indexOf(`"${table}" (`), up.indexOf(')\n    `', up.indexOf(`"${table}" (`)));
      for (const cascade of cascades) {
        expect(body).toContain(cascade);
      }
    }
    expect(up).toContain('"grant_id" uuid NOT NULL REFERENCES "mcp_oauth_grants" ("id") ON DELETE CASCADE');
  });

  it('allows only access and refresh tokens', () => {
    expect(up).toContain(`CHECK ("kind" IN ('access', 'refresh'))`);
  });
});
