import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

describe('AddSecurityPrices migration', () => {
  const filePath = path.join(process.cwd(), 'src', 'migrations', '1788300000000-AddSecurityPrices.ts');
  const source = () => readFileSync(filePath, 'utf8');
  const up = () => source().slice(0, source().indexOf('public async down'));
  const down = () => source().slice(source().indexOf('public async down'));
  const table = (name: string) => {
    const text = up();
    const start = text.indexOf(`CREATE TABLE IF NOT EXISTS "${name}"`);
    return text.slice(start, text.indexOf('`', start));
  };

  it('creates the tables idempotently and backfills nothing', () => {
    expect(existsSync(filePath)).toBe(true);
    for (const name of ['security_prices', 'security_price_symbols', 'workspace_security_prices']) {
      expect(up()).toContain(`CREATE TABLE IF NOT EXISTS "${name}"`);
    }
    expect(up()).not.toMatch(/INSERT INTO|UPDATE "/);
  });

  it('keeps the feed tables free of workspace data', () => {
    expect(table('security_prices')).not.toContain('workspace_id');
    expect(table('security_price_symbols')).not.toContain('workspace_id');
  });

  it('scopes the closes a workspace enters to it, and deletes them with it', () => {
    const own = table('workspace_security_prices');
    expect(own).toContain('"workspace_id" uuid NOT NULL');
    expect(own).toContain('REFERENCES "workspaces"("id") ON DELETE CASCADE');
    expect(own).toContain(`CHECK ("source" IN ('manual', 'import'))`);
  });

  it('keeps one close per symbol and day, per workspace for the own ones', () => {
    expect(up()).toContain('ON "security_prices" ("symbol", "price_date")');
    expect(up()).toContain('ON "workspace_security_prices" ("workspace_id", "symbol", "price_date")');
    expect(up().match(/CREATE UNIQUE INDEX IF NOT EXISTS/g)).toHaveLength(2);
  });

  it('refuses a close of zero or less', () => {
    expect(table('security_prices')).toContain('CHECK ("close" > 0)');
    expect(table('workspace_security_prices')).toContain('CHECK ("close" > 0)');
  });

  it('drops each index before its table', () => {
    const text = down();
    expect(text.indexOf('UQ_workspace_security_prices_symbol_date')).toBeLessThan(
      text.indexOf('DROP TABLE IF EXISTS "workspace_security_prices"'),
    );
    expect(text.indexOf('UQ_security_prices_symbol_date')).toBeLessThan(
      text.indexOf('DROP TABLE IF EXISTS "security_prices"'),
    );
  });
});
