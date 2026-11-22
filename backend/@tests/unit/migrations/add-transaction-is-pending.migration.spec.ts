import { AddTransactionIsPending1789080000000 } from '@/migrations/1789080000000-AddTransactionIsPending';
import type { QueryRunner } from 'typeorm';

describe('AddTransactionIsPending1789080000000', () => {
  const run = async (step: 'up' | 'down') => {
    const query = vi.fn().mockResolvedValue(undefined);
    await new AddTransactionIsPending1789080000000()[step]({
      query,
    } as unknown as QueryRunner);
    return query;
  };

  it('adds the flag as a NOT NULL column that defaults to a booked row, and a partial index', async () => {
    const query = await run('up');

    const sql = query.mock.calls.map(([statement]) => statement as string);
    expect(sql.slice(0, 2)).toEqual([
      'ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "is_pending" boolean NOT NULL DEFAULT false',
      'CREATE INDEX IF NOT EXISTS "IDX_transactions_workspace_pending" ON "transactions" ("workspace_id") WHERE "is_pending" = true',
    ]);
    // The bank booking a row re-queues it for the ledger.
    expect(sql[2]).toContain('NEW."is_verified", NEW."is_pending")');
    expect(sql[2]).toContain('OLD."is_verified", OLD."is_pending")');
  });

  it('restores the trigger function, deletes pending rows, then drops the index and column', async () => {
    const query = await run('down');
    const sql = query.mock.calls.map(([statement]) => statement as string);

    expect(sql[0]).toContain('NEW."is_verified")');
    expect(sql[0]).not.toContain('is_pending');
    expect(sql.slice(1)).toEqual([
      'DELETE FROM "transactions" WHERE "is_pending" = true',
      'DROP INDEX IF EXISTS "IDX_transactions_workspace_pending"',
      'ALTER TABLE "transactions" DROP COLUMN IF EXISTS "is_pending"',
    ]);
  });
});
