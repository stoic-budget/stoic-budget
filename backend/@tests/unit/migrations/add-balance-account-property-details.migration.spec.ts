import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

describe('AddBalanceAccountPropertyDetails migration', () => {
  const filePath = path.join(
    process.cwd(),
    'src',
    'migrations',
    '1788250000000-AddBalanceAccountPropertyDetails.ts',
  );
  const source = () => readFileSync(filePath, 'utf8');

  it('adds each column only when it is missing', () => {
    expect(existsSync(filePath)).toBe(true);
    for (const column of ['attributes jsonb', 'debt_wallet_id uuid', 'debt_account_id uuid']) {
      expect(source()).toContain(`ADD COLUMN IF NOT EXISTS ${column}`);
    }
    expect(source()).toContain('ADD COLUMN IF NOT EXISTS depreciation_rate numeric(5,2)');
  });

  it('unlinks a debt that is deleted instead of blocking the delete', () => {
    expect(source()).toMatch(/debt_wallet_id uuid\s+REFERENCES wallets\(id\) ON DELETE SET NULL/);
    expect(source()).toMatch(
      /debt_account_id uuid\s+REFERENCES balance_accounts\(id\) ON DELETE SET NULL/,
    );
  });

  it('links one debt per property and one property per debt', () => {
    expect(source()).toContain('CHECK (debt_wallet_id IS NULL OR debt_account_id IS NULL)');
    expect(source()).toMatch(
      /CREATE UNIQUE INDEX IF NOT EXISTS "UQ_balance_accounts_debt_wallet"\s+ON balance_accounts \(debt_wallet_id\) WHERE debt_wallet_id IS NOT NULL/,
    );
    expect(source()).toMatch(
      /CREATE UNIQUE INDEX IF NOT EXISTS "UQ_balance_accounts_debt_account"\s+ON balance_accounts \(debt_account_id\) WHERE debt_account_id IS NOT NULL/,
    );
  });

  it('keeps a depreciation rate between 0 and 100 percent', () => {
    expect(source()).toContain('depreciation_rate > 0 AND depreciation_rate <= 100');
  });

  it('drops everything on the way down', () => {
    for (const column of ['attributes', 'debt_wallet_id', 'debt_account_id', 'depreciation_rate']) {
      expect(source()).toContain(`DROP COLUMN IF EXISTS ${column}`);
    }
  });
});
