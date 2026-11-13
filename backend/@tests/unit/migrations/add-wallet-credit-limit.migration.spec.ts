import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { AddWalletCreditLimit1788500000000 } from '../../../src/migrations/1788500000000-AddWalletCreditLimit';

describe('AddWalletCreditLimit migration', () => {
  const filePath = path.join(
    process.cwd(),
    'src',
    'migrations',
    '1788500000000-AddWalletCreditLimit.ts',
  );
  const check = 'CHK_wallets_credit_limit_card_only';

  const run = async (step: 'up' | 'down') => {
    const queries: string[] = [];
    const queryRunner = { query: async (sql: string) => void queries.push(sql) };
    await new AddWalletCreditLimit1788500000000()[step](queryRunner as never);
    return queries;
  };

  it('adds a nullable money column, so existing accounts keep no limit', async () => {
    expect(existsSync(filePath)).toBe(true);
    const [column] = await run('up');
    expect(column).toContain('ALTER TABLE "wallets" ADD COLUMN IF NOT EXISTS "credit_limit"');
    expect(column).toContain('numeric(15,2)');
    expect(column).not.toContain('NOT NULL');
    expect(column).not.toContain('DEFAULT');
  });

  it('lets only a credit card hold a limit, and can run twice', async () => {
    const [, drop, add] = await run('up');
    expect(drop).toBe(`ALTER TABLE "wallets" DROP CONSTRAINT IF EXISTS "${check}"`);
    expect(add).toContain(`ADD CONSTRAINT "${check}"`);
    expect(add).toContain(`CHECK ("type" = 'credit_card' OR "credit_limit" IS NULL)`);
  });

  it('never rewrites existing rows', () => {
    expect(readFileSync(filePath, 'utf8')).not.toMatch(/UPDATE\s+"wallets"/);
  });

  it('reverses itself', async () => {
    expect(await run('down')).toEqual([
      `ALTER TABLE "wallets" DROP CONSTRAINT IF EXISTS "${check}"`,
      'ALTER TABLE "wallets" DROP COLUMN IF EXISTS "credit_limit"',
    ]);
  });
});
