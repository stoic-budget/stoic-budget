import { AddTransactionIsPending1788200000000 } from '@/migrations/1788200000000-AddTransactionIsPending';
import type { QueryRunner } from 'typeorm';

describe('AddTransactionIsPending1788200000000', () => {
  const run = async (step: 'up' | 'down') => {
    const query = vi.fn().mockResolvedValue(undefined);
    await new AddTransactionIsPending1788200000000()[step]({
      query,
    } as unknown as QueryRunner);
    return query;
  };

  it('adds the flag as a NOT NULL column that defaults to a booked row, and a partial index', async () => {
    const query = await run('up');

    expect(query.mock.calls.map(([sql]) => sql)).toEqual([
      'ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "is_pending" boolean NOT NULL DEFAULT false',
      'CREATE INDEX IF NOT EXISTS "IDX_transactions_workspace_pending" ON "transactions" ("workspace_id") WHERE "is_pending" = true',
    ]);
  });

  it('drops the index and then the column on the way down', async () => {
    const query = await run('down');

    expect(query.mock.calls.map(([sql]) => sql)).toEqual([
      'DROP INDEX IF EXISTS "IDX_transactions_workspace_pending"',
      'ALTER TABLE "transactions" DROP COLUMN IF EXISTS "is_pending"',
    ]);
  });
});
