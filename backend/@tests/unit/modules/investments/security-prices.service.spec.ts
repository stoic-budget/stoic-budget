import { SecurityPricesService } from '@/modules/investments/security-prices.service';
import { STALE_AFTER_FAILURES } from '@/modules/investments/price-history';

/** Repositories just deep enough for the feed's bookkeeping. */
function createService(options: {
  symbol?: Record<string, unknown> | null;
  fetched?: { currency: string; closes: Array<{ date: string; close: number }> } | null;
  held?: string[];
}) {
  const inserted: unknown[][] = [];
  const insert = {
    insert: () => insert,
    into: () => insert,
    values: (rows: unknown[]) => {
      inserted.push(rows);
      return insert;
    },
    orUpdate: () => insert,
    execute: async () => undefined,
  };
  const prices = { createQueryBuilder: () => insert };
  const symbols = {
    findOne: vi.fn(async () => options.symbol ?? null),
    find: vi.fn(async () => (options.symbol ? [options.symbol] : [])),
    save: vi.fn(async (row: unknown) => row),
  };
  const holdingQuery = {
    select: () => holdingQuery,
    where: () => holdingQuery,
    andWhere: () => holdingQuery,
    getRawMany: async () => (options.held ?? []).map(symbol => ({ symbol })),
  };
  const holdings = { createQueryBuilder: () => holdingQuery };
  const stock = { fetchDailyCloses: vi.fn(async () => options.fetched ?? null) };
  const service = new SecurityPricesService(
    prices as never,
    symbols as never,
    {} as never,
    holdings as never,
    stock as never,
  );
  return { service, symbols, stock, inserted };
}

const NOW = new Date('2026-03-10T05:00:00Z');
const CLOSES = {
  currency: 'USD',
  closes: [
    { date: '2026-03-05', close: 10 },
    { date: '2026-03-06', close: 11 },
  ],
};

describe('SecurityPricesService', () => {
  it('backfills ten years on first use, stores the closes and marks the symbol done', async () => {
    const { service, stock, symbols, inserted } = createService({ fetched: CLOSES });

    await service.ensureBackfilled('ACME.US', NOW);

    expect(stock.fetchDailyCloses).toHaveBeenCalledWith('ACME.US', '10y');
    expect(inserted.flat()).toEqual([
      { symbol: 'ACME.US', priceDate: '2026-03-05', close: '10', currency: 'USD' },
      { symbol: 'ACME.US', priceDate: '2026-03-06', close: '11', currency: 'USD' },
    ]);
    expect(symbols.save).toHaveBeenCalledWith({
      symbol: 'ACME.US',
      currency: 'USD',
      consecutiveFailures: 0,
      lastCloseOn: '2026-03-06',
      lastAttemptAt: NOW,
      backfilledAt: NOW,
    });
  });

  it('asks only once for a symbol already backfilled', async () => {
    const { service, stock } = createService({ symbol: { symbol: 'ACME.US', backfilledAt: NOW } });

    await service.ensureBackfilled('ACME.US', NOW);

    expect(stock.fetchDailyCloses).not.toHaveBeenCalled();
  });

  it('waits an hour before trying a failed backfill again', async () => {
    const tried = {
      symbol: 'ACME.US',
      backfilledAt: null,
      consecutiveFailures: 1,
      lastCloseOn: null,
      lastAttemptAt: new Date(NOW.getTime() - 10 * 60 * 1000),
    };
    const soon = createService({ symbol: tried });
    await soon.service.ensureBackfilled('ACME.US', NOW);
    expect(soon.stock.fetchDailyCloses).not.toHaveBeenCalled();

    const later = createService({ symbol: tried });
    await later.service.ensureBackfilled('ACME.US', new Date(NOW.getTime() + 60 * 60 * 1000));
    expect(later.stock.fetchDailyCloses).toHaveBeenCalledTimes(1);
  });

  it('counts a failed fetch and keeps the last close and the backfill', async () => {
    const backfilled = new Date('2026-01-01T00:00:00Z');
    const { service, symbols, stock } = createService({
      held: ['ACME.US'],
      symbol: {
        symbol: 'ACME.US',
        currency: 'USD',
        consecutiveFailures: STALE_AFTER_FAILURES - 1,
        lastCloseOn: '2026-03-02',
        lastAttemptAt: null,
        backfilledAt: backfilled,
      },
      fetched: null,
    });

    const result = await service.recordDailyCloses(NOW);

    expect(result).toEqual({ fetched: 0, failed: 1 });
    // The daily run asks for a month only once the history is in.
    expect(stock.fetchDailyCloses).toHaveBeenCalledWith('ACME.US', '1mo');
    expect(symbols.save).toHaveBeenCalledWith(
      expect.objectContaining({
        consecutiveFailures: STALE_AFTER_FAILURES,
        lastCloseOn: '2026-03-02',
        currency: 'USD',
        backfilledAt: backfilled,
      }),
    );
  });

  it('a failed first backfill is not marked done, so the next run tries ten years again', async () => {
    const { service, symbols } = createService({ held: ['ACME.US'], fetched: null });

    await service.recordDailyCloses(NOW);

    expect(symbols.save).toHaveBeenCalledWith(
      expect.objectContaining({ backfilledAt: null, consecutiveFailures: 1 }),
    );
  });
});
