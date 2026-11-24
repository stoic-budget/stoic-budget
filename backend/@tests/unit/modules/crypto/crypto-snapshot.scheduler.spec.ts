import { describe, expect, it, vi } from 'vitest';
import { CryptoSnapshotScheduler } from '../../../../src/modules/crypto/crypto-snapshot.scheduler';

/** Every workspace with crypto gets today's value once a day (#694). */
describe('CryptoSnapshotScheduler', () => {
  const build = (workspaceIds: string[]) => {
    const query: Record<string, unknown> = {};
    for (const method of ['innerJoin', 'select', 'where']) query[method] = vi.fn(() => query);
    query.getRawMany = vi.fn(async () => workspaceIds.map(workspaceId => ({ workspaceId })));
    const walletRepo = { createQueryBuilder: vi.fn(() => query) };
    const balanceService = {
      writePortfolioSnapshot: vi.fn(async (workspaceId: string) => {
        if (workspaceId === 'ws-broken') throw new Error('no price source');
      }),
    };
    const scheduler = new CryptoSnapshotScheduler(walletRepo as never, balanceService as never);
    return { scheduler, query, balanceService };
  };

  it('writes each workspace once, and goes on past one that fails', async () => {
    const { scheduler, balanceService } = build(['ws-1', 'ws-broken', 'ws-2']);

    await scheduler.writeDailySnapshots();

    expect(balanceService.writePortfolioSnapshot.mock.calls.map(call => call[0])).toEqual([
      'ws-1',
      'ws-broken',
      'ws-2',
    ]);
  });

  it('leaves past versions alone', async () => {
    const { scheduler, query } = build([]);

    await scheduler.writeDailySnapshots();

    expect(query.where).toHaveBeenCalledWith('workspace.kind = :kind', { kind: 'standard' });
  });
});
