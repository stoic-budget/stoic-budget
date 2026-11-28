import { describe, expect, it, vi } from 'vitest';
import { CryptoSnapshotScheduler } from '../../../../src/modules/crypto/crypto-snapshot.scheduler';

/** Every workspace with crypto gets today's value once a day (#694). */
describe('CryptoSnapshotScheduler', () => {
  const build = (workspaceIds: string[]) => {
    const walletRepo = { query: vi.fn(async () => workspaceIds.map(workspaceId => ({ workspaceId }))) };
    const balanceService = {
      writePortfolioSnapshot: vi.fn(async (workspaceId: string) => {
        if (workspaceId === 'ws-broken') throw new Error('no price source');
      }),
    };
    const scheduler = new CryptoSnapshotScheduler(walletRepo as never, balanceService as never);
    return { scheduler, walletRepo, balanceService };
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

  it('asks for standard workspaces only, and for those still showing a crypto line', async () => {
    const { scheduler, walletRepo } = build([]);

    await scheduler.writeDailySnapshots();

    const [sql, params] = walletRepo.query.mock.calls[0] as unknown as [string, unknown[]];
    expect(params).toEqual(['standard']);
    expect(sql).toContain('"account_kind" = \'crypto\'');
  });
});
