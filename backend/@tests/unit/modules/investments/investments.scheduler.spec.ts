import { InvestmentsScheduler } from '@/modules/investments/investments.scheduler';

describe('InvestmentsScheduler', () => {
  function createScheduler(overrides: Partial<Record<string, unknown>> = {}) {
    const investments = {
      workspacesWithPricedHoldings: vi.fn(async () => ['ws-1', 'ws-2']),
      refreshPrices: vi.fn(async () => ({ updated: 2, asked: 2 })),
      ...overrides,
    } as any;
    const securityPrices = {
      recordDailyCloses: vi.fn(async () => ({ fetched: 3, failed: 0 })),
      ...(overrides.securityPrices as object),
    } as any;
    const metals = {
      refreshPrices: vi.fn(async () => 1),
      ...(overrides.metals as object),
    } as any;
    const holdings = {
      createQueryBuilder: () => ({
        select: () => ({
          where: () => ({
            andWhere: () => ({ getRawMany: async () => [{ workspaceId: 'ws-gold' }] }),
          }),
        }),
      }),
    } as any;
    const scheduler = new InvestmentsScheduler(investments, securityPrices, metals, holdings);
    // The logger would print the caught error into the test output.
    vi.spyOn((scheduler as any).logger, 'error').mockImplementation(() => undefined);
    vi.spyOn((scheduler as any).logger, 'log').mockImplementation(() => undefined);
    return { scheduler, investments, securityPrices, metals };
  }

  it('reprices every workspace that holds something with a price', async () => {
    const { scheduler, investments } = createScheduler();

    await scheduler.refreshAllPrices();

    // Null actor: nobody pressed anything, so the snapshot is the system's.
    expect(investments.refreshPrices).toHaveBeenCalledWith(null, 'ws-1');
    expect(investments.refreshPrices).toHaveBeenCalledWith(null, 'ws-2');
  });

  it('reprices precious metals every day too, as the system (#696)', async () => {
    const { scheduler, metals } = createScheduler();

    await scheduler.refreshMetalPrices();

    expect(metals.refreshPrices).toHaveBeenCalledWith(null, 'ws-gold');
  });

  it('keeps going when one workspace cannot be priced', async () => {
    const refreshPrices = vi
      .fn()
      .mockRejectedValueOnce(new Error('Quotes are down'))
      .mockResolvedValueOnce({ updated: 1, asked: 1 });
    const { scheduler } = createScheduler({ refreshPrices });

    await expect(scheduler.refreshAllPrices()).resolves.toBeUndefined();
    expect(refreshPrices).toHaveBeenCalledTimes(2);
  });

  it('does nothing when no workspace holds a priced position', async () => {
    const { scheduler, investments } = createScheduler({
      workspacesWithPricedHoldings: vi.fn(async () => []),
    });

    await scheduler.refreshAllPrices();

    expect(investments.refreshPrices).not.toHaveBeenCalled();
  });

  it('records the daily closes, and a failing feed does not throw out of the job', async () => {
    const { scheduler, securityPrices } = createScheduler({
      securityPrices: { recordDailyCloses: vi.fn().mockRejectedValue(new Error('Feed down')) },
    });

    await expect(scheduler.recordDailyCloses()).resolves.toBeUndefined();
    expect(securityPrices.recordDailyCloses).toHaveBeenCalledTimes(1);
  });
});
