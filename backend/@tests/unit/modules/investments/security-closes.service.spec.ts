import { InvestmentPriceSource } from '@/entities/investment-holding.entity';
import { SecurityClosesService } from '@/modules/investments/security-closes.service';

const WORKSPACE = 'ws-1';
const SYMBOL = 'ACME';
const NOW = new Date('2026-11-09T21:30:00.000Z');

interface CloseRow {
  id: string;
  workspaceId: string;
  symbol: string;
  priceDate: string;
  close: string;
  currency: string;
  source: string;
}

interface HoldingRow {
  id: string;
  workspaceId: string;
  accountId: string;
  symbol: string;
  price: number;
  priceCurrency: string;
  priceSource: InvestmentPriceSource;
  pricedAt: Date | null;
}

/** The closes table as a list: upserts by (workspace, symbol, day), newest first on request. */
function createService(options: {
  holding: Omit<HoldingRow, 'id' | 'workspaceId' | 'accountId' | 'symbol'>;
  closes?: Array<Omit<CloseRow, 'id' | 'workspaceId' | 'symbol' | 'source'>>;
  /** What the feed and the workspace's closes merged say, oldest first. */
  merged?: Array<{ date: string; close: number; currency: string; source: 'auto' | 'manual' | 'import' }>;
}) {
  const holding: HoldingRow = {
    id: 'holding-1',
    workspaceId: WORKSPACE,
    accountId: 'account-1',
    symbol: SYMBOL,
    ...options.holding,
  };
  const rows: CloseRow[] = (options.closes ?? []).map((close, index) => ({
    id: `close-${index}`,
    workspaceId: WORKSPACE,
    symbol: SYMBOL,
    source: 'manual',
    ...close,
  }));
  const pending: CloseRow[] = [];
  const insert = {
    insert: () => insert,
    into: () => insert,
    values: (values: Array<Omit<CloseRow, 'id'>>) => {
      pending.push(...values.map(value => ({ ...value, id: `close-${value.priceDate}` })));
      return insert;
    },
    orUpdate: () => insert,
    execute: async () => {
      for (const row of pending.splice(0)) {
        const index = rows.findIndex(
          existing => existing.workspaceId === row.workspaceId && existing.priceDate === row.priceDate,
        );
        if (index >= 0) rows[index] = { ...row, id: rows[index].id };
        else rows.push(row);
      }
    },
  };
  const matches = (where: Partial<CloseRow>) => (row: CloseRow) =>
    Object.entries(where).every(([key, value]) => row[key as keyof CloseRow] === value);
  const closeRepository = {
    createQueryBuilder: () => insert,
    count: vi.fn(async () => 0),
    findOne: vi.fn(async ({ where }: { where: Partial<CloseRow> }) => {
      const found = rows.filter(matches(where)).sort((a, b) => b.priceDate.localeCompare(a.priceDate));
      return found[0] ?? null;
    }),
    findOneOrFail: vi.fn(async ({ where }: { where: Partial<CloseRow> }) => rows.find(matches(where))),
    delete: vi.fn(async ({ id }: { id: string }) => {
      const index = rows.findIndex(row => row.id === id);
      rows.splice(index, 1);
      return { affected: 1 };
    }),
  };
  const holdingRepository = {
    findOne: vi.fn(async () => holding),
    find: vi.fn(async () => [holding]),
    update: vi.fn(async (_where: unknown, patch: Partial<HoldingRow>) => {
      Object.assign(holding, patch);
    }),
  };
  const investments = { writeSnapshot: vi.fn(async () => undefined) };
  const prices = {
    closesFor: vi.fn(async () => new Map([[SYMBOL, options.merged ?? []]])),
  };
  const service = new SecurityClosesService(
    closeRepository as never,
    holdingRepository as never,
    investments as never,
    prices as never,
  );
  return { service, holding, holdingRepository, investments, rows };
}

describe('SecurityClosesService', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const fresh = {
    price: 150,
    priceCurrency: 'USD',
    priceSource: InvestmentPriceSource.AUTO,
    pricedAt: new Date('2026-11-06T16:00:00.000Z'),
  };

  it('leaves a holding priced later than the close at its own price', async () => {
    const { service, holding, holdingRepository, investments } = createService({ holding: fresh });

    await service.upsert('user-1', WORKSPACE, 'holding-1', { date: '2026-11-02', close: 90 });

    expect(holdingRepository.update).not.toHaveBeenCalled();
    expect(investments.writeSnapshot).not.toHaveBeenCalled();
    expect(holding).toMatchObject({ price: 150, priceSource: InvestmentPriceSource.AUTO });
  });

  it('prices a holding priced before the close at it, and writes the account again', async () => {
    const { service, holding, investments } = createService({ holding: fresh });

    await service.upsert('user-1', WORKSPACE, 'holding-1', { date: '2026-11-09', close: 101 });

    expect(holding).toMatchObject({
      price: 101,
      priceSource: InvestmentPriceSource.MANUAL,
      pricedAt: new Date('2026-11-09T00:00:00.000Z'),
    });
    expect(investments.writeSnapshot).toHaveBeenCalledWith('user-1', WORKSPACE, 'account-1');
  });

  it('does not put back a same-day close of its own when an older close is typed in', async () => {
    // Today's own close was 101; the feed has since priced the holding at 105 today.
    const { service, holding, holdingRepository } = createService({
      holding: { ...fresh, price: 105, pricedAt: new Date('2026-11-09T16:23:00.000Z') },
      closes: [{ priceDate: '2026-11-09', close: '101', currency: 'USD' }],
    });

    await service.upsert('user-1', WORKSPACE, 'holding-1', { date: '2026-04-23', close: 50 });

    expect(holdingRepository.update).not.toHaveBeenCalled();
    expect(holding.price).toBe(105);
  });

  it('leaves the price alone when an import brings no close at all', async () => {
    const { service, holdingRepository } = createService({
      holding: fresh,
      closes: [{ priceDate: '2026-11-09', close: '101', currency: 'USD' }],
    });

    const result = await service.import('user-1', WORKSPACE, 'holding-1', {
      csv: 'Date,Close\n2030-01-02,10\n',
    });

    expect(result.created + result.updated).toBe(0);
    expect(holdingRepository.update).not.toHaveBeenCalled();
  });

  it('takes a price that came from a deleted close back to the newest close left', async () => {
    const { service, holding, investments, rows } = createService({
      holding: {
        price: 1500,
        priceCurrency: 'USD',
        priceSource: InvestmentPriceSource.MANUAL,
        pricedAt: new Date('2026-11-09T00:00:00.000Z'),
      },
      closes: [{ priceDate: '2026-11-09', close: '1500', currency: 'USD' }],
      merged: [
        { date: '2026-11-05', close: 149, currency: 'USD', source: 'auto' },
        { date: '2026-11-06', close: 150, currency: 'USD', source: 'auto' },
      ],
    });

    await service.remove('user-1', WORKSPACE, rows[0].id);

    expect(rows).toHaveLength(0);
    expect(holding).toMatchObject({
      price: 150,
      priceSource: InvestmentPriceSource.AUTO,
      pricedAt: new Date('2026-11-06T00:00:00.000Z'),
    });
    expect(investments.writeSnapshot).toHaveBeenCalledWith('user-1', WORKSPACE, 'account-1');
  });

  it('keeps the price when the deleted close is not the one it came from', async () => {
    const { service, holdingRepository, rows } = createService({
      holding: fresh,
      closes: [{ priceDate: '2026-10-01', close: '120', currency: 'USD' }],
      merged: [{ date: '2026-11-06', close: 150, currency: 'USD', source: 'auto' }],
    });

    await service.remove('user-1', WORKSPACE, rows[0].id);

    expect(holdingRepository.update).not.toHaveBeenCalled();
  });

  it('takes the user\'s today east of UTC, and nothing after it', async () => {
    // 21:30 UTC is already the next morning in UTC+5.
    const { service } = createService({ holding: fresh });

    await expect(
      service.upsert('user-1', WORKSPACE, 'holding-1', { date: '2026-11-10', close: 151 }),
    ).resolves.toMatchObject({ date: '2026-11-10' });
    await expect(
      service.upsert('user-1', WORKSPACE, 'holding-1', { date: '2026-11-11', close: 152 }),
    ).rejects.toMatchObject({ status: 400 });
  });
});
