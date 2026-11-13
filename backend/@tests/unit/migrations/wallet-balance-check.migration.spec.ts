import type { QueryRunner } from 'typeorm';
import { AddWalletBalanceCheck1788530000000 } from '../../../src/migrations/1788530000000-AddWalletBalanceCheck';

const run = async (direction: 'up' | 'down'): Promise<string[]> => {
  const sql: string[] = [];
  const queryRunner = { query: vi.fn(async (statement: string) => sql.push(statement)) };
  await new AddWalletBalanceCheck1788530000000()[direction](queryRunner as unknown as QueryRunner);
  return sql;
};

describe('AddWalletBalanceCheck migration', () => {
  it('adds the day and the bank balance of the last check, both optional and re-runnable', async () => {
    const up = await run('up');
    expect(up.slice(0, 2)).toEqual([
      'ALTER TABLE "wallets" ADD COLUMN IF NOT EXISTS "balance_checked_at" date',
      'ALTER TABLE "wallets" ADD COLUMN IF NOT EXISTS "balance_checked_amount" numeric(15,2)',
    ]);
    expect(up.join('\n')).not.toContain('NOT NULL');
  });

  it('keeps every adjustment free of category and tax, re-runnably, on insert and update', async () => {
    const up = (await run('up')).join('\n');
    expect(up).toContain('CREATE OR REPLACE FUNCTION "transactions_adjustment_uncategorised"()');
    for (const column of ['category_id', 'private_category_id', 'tax_rate_id', 'tax_amount']) {
      expect(up).toContain(`NEW."${column}" := NULL`);
    }
    expect(up).toContain('DROP TRIGGER IF EXISTS "trg_transactions_adjustment_uncategorised"');
    // Fires before "TRG_transactions_ledger_dirty" (BEFORE triggers run in name order), so the ledger
    // sees the cleared category.
    expect(up).toContain('CREATE TRIGGER "TRG_transactions_adjustment_uncategorised"');
    expect('TRG_transactions_adjustment_uncategorised' < 'TRG_transactions_ledger_dirty').toBe(true);
    expect(up).toContain('BEFORE INSERT OR UPDATE ON "transactions"');
    expect(up).toContain(`WHEN (NEW."transfer_pair_kind" = 'adjustment')`);
  });

  it('drops the trigger, its function and both columns on the way down', async () => {
    const down = await run('down');
    expect(down).toEqual([
      'DROP TRIGGER IF EXISTS "TRG_transactions_adjustment_uncategorised" ON "transactions"',
      'DROP TRIGGER IF EXISTS "trg_transactions_adjustment_uncategorised" ON "transactions"',
      'DROP FUNCTION IF EXISTS "transactions_adjustment_uncategorised"()',
      'ALTER TABLE "wallets" DROP COLUMN IF EXISTS "balance_checked_amount"',
      'ALTER TABLE "wallets" DROP COLUMN IF EXISTS "balance_checked_at"',
    ]);
  });
});
