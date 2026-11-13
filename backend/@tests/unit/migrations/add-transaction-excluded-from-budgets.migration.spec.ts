import { AddTransactionExcludedFromBudgets1788160000000 } from '@/migrations/1788160000000-AddTransactionExcludedFromBudgets';
import type { QueryRunner } from 'typeorm';

describe('AddTransactionExcludedFromBudgets1788160000000', () => {
  const run = async (step: 'up' | 'down') => {
    const query = vi.fn().mockResolvedValue(undefined);
    await new AddTransactionExcludedFromBudgets1788160000000()[step]({
      query,
    } as unknown as QueryRunner);
    return query;
  };

  it('adds the flag as a NOT NULL column that defaults to counting the row', async () => {
    const query = await run('up');

    expect(query).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenCalledWith(
      'ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "excluded_from_budgets" boolean NOT NULL DEFAULT false',
    );
  });

  it('drops only that column on the way down', async () => {
    const query = await run('down');

    expect(query).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenCalledWith(
      'ALTER TABLE "transactions" DROP COLUMN IF EXISTS "excluded_from_budgets"',
    );
  });
});
