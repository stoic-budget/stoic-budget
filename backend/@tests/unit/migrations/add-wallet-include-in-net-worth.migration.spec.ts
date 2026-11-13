import type { QueryRunner } from 'typeorm';
import { AddWalletIncludeInNetWorth1788510000000 } from '@/migrations/1788510000000-AddWalletIncludeInNetWorth';

describe('AddWalletIncludeInNetWorth1788510000000', () => {
  const run = async (direction: 'up' | 'down') => {
    const query = vi.fn().mockResolvedValue(undefined);
    await new AddWalletIncludeInNetWorth1788510000000()[direction]({
      query,
    } as unknown as QueryRunner);
    return query;
  };

  it('adds the flag so every existing account keeps counting, and can run twice', async () => {
    const query = await run('up');
    expect(query).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenCalledWith(
      'ALTER TABLE "wallets" ADD COLUMN IF NOT EXISTS "include_in_net_worth" boolean NOT NULL DEFAULT true',
    );
  });

  it('drops the flag on the way down', async () => {
    const query = await run('down');
    expect(query).toHaveBeenCalledWith(
      'ALTER TABLE "wallets" DROP COLUMN IF EXISTS "include_in_net_worth"',
    );
  });
});
