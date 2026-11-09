import { InvestmentAssetClass } from '@/entities/investment-holding.entity';
import type { ImportContext } from '@/modules/entity-imports/targets/target.types';
import { parseRatio, TradesTarget } from '@/modules/entity-imports/targets/trades.target';

const WORKSPACE = 'ws-1';
type Row = string[];

const fund = {
  id: 'h-fund',
  workspaceId: WORKSPACE,
  accountId: 'acc-1',
  symbol: 'ACME.US',
  name: 'ACME Fund',
  assetClass: InvestmentAssetClass.ETF,
  quantity: '0',
  priceCurrency: 'USD',
};

function context(
  options: {
    holdings?: Array<Record<string, unknown>>;
    trades?: Array<Record<string, unknown>>;
    accountId?: string | null;
    create?: boolean;
  } = {},
) {
  const savedTrades: Record<string, unknown>[] = [];
  const savedHoldings: Record<string, unknown>[] = [];
  const updates: Array<{ id: string; quantity: number }> = [];
  const repos: Record<string, unknown> = {
    BalanceAccount: { find: vi.fn(async () => [{ id: 'acc-1' }]) },
    InvestmentHolding: {
      find: vi.fn(async () => options.holdings ?? [fund]),
      findOne: vi.fn(async () => null),
      create: vi.fn((row: Record<string, unknown>) => row),
      save: vi.fn(async (row: Record<string, unknown>) => {
        savedHoldings.push(row);
        return { ...row, id: `h-new-${savedHoldings.length}` };
      }),
      update: vi.fn(async (where: { id: string }, values: { quantity: number }) => {
        updates.push({ id: where.id, quantity: values.quantity });
      }),
    },
    InvestmentTrade: {
      find: vi.fn(async () => options.trades ?? []),
      create: vi.fn((row: Record<string, unknown>) => row),
      save: vi.fn(async (row: Record<string, unknown>) => {
        savedTrades.push(row);
        return { ...row, id: `t-${savedTrades.length}` };
      }),
    },
  };
  const mapping: Record<string, number> = {
    date: 0,
    kind: 1,
    symbol: 2,
    name: 3,
    quantity: 4,
    price: 5,
    fee: 6,
    amount: 7,
    ratio: 8,
    currency: 9,
  };
  const ctx = {
    workspaceId: WORKSPACE,
    userId: 'user-1',
    manager: { getRepository: (entity: { name: string }) => repos[entity.name] },
    currency: 'EUR',
    investmentAccountId: options.accountId ?? null,
    createMissingHoldings: options.create === true,
    cell: (row: Row, field: string) => {
      const index = mapping[field];
      return Number.isInteger(index) ? String(row[index] ?? '') : '';
    },
    created: [],
    updated: [],
  } as unknown as ImportContext;
  return { ctx, savedTrades, savedHoldings, updates };
}

// date, kind, symbol, name, quantity, price, fee, amount, ratio, currency
const row = (...cells: string[]): Row => cells;

describe('TradesTarget', () => {
  it('reads a broker export and derives the holding quantity from it', async () => {
    const { ctx, savedTrades, updates } = context();
    const results = await new TradesTarget().run(
      [
        row('2025-01-10', 'Buy', 'acme', '', '10', '100', '1', '', '', 'USD'),
        row('2025-02-10', 'Sell', 'ACME', '', '-4', '120', '1', '', '', 'USD'),
        row('2025-03-01', 'Dividend', 'ACME', '', '', '', '0.5', '3', '', 'USD'),
        row('2025-04-01', 'split', 'ACME', '', '', '', '', '', '3:1', 'USD'),
      ],
      ctx,
      false,
    );
    expect(results.map(item => item.status)).toEqual(['created', 'created', 'created', 'created']);
    // A broker writes a sale as a negative quantity; it is still four units out.
    expect(savedTrades[1]).toMatchObject({ kind: 'sell', quantity: 4, price: 120, fee: 1 });
    expect(savedTrades[2]).toMatchObject({ kind: 'dividend', amount: 3, fee: 0.5, quantity: 0 });
    expect(savedTrades[3]).toMatchObject({ kind: 'split', splitTo: 3, splitFrom: 1 });
    // (10 − 4) × 3 after the split.
    expect(updates).toEqual([{ id: 'h-fund', quantity: 18 }]);
    expect(ctx.updated).toEqual([
      { kind: 'investment_holding', id: 'h-fund', before: { quantity: '0' } },
    ]);
  });

  it('leaves a typed-in quantity alone when the sheet holds only dividends', async () => {
    const typed = { ...fund, quantity: '7', price: '10' };
    const { ctx, savedTrades, updates } = context({ holdings: [typed] });
    const results = await new TradesTarget().run(
      [row('2025-02-01', 'Dividend', 'ACME', '', '', '', '', '4', '', 'USD')],
      ctx,
      false,
    );
    expect(results).toEqual([{ index: 0, status: 'created', id: 't-1' }]);
    expect(savedTrades[0]).toMatchObject({ kind: 'dividend', amount: 4 });
    expect(updates).toEqual([{ id: 'h-fund', quantity: '7' }]);
  });

  it('refuses a sale the history cannot cover, row by row', async () => {
    const { ctx, savedTrades } = context();
    const results = await new TradesTarget().run(
      [
        row('2025-01-10', 'Buy', 'ACME', '', '2', '100', '', '', '', ''),
        row('2025-01-11', 'Sell', 'ACME', '', '3', '100', '', '', '', ''),
      ],
      ctx,
      false,
    );
    expect(results[1]).toMatchObject({ status: 'error', reason: 'exceeds_holding' });
    expect(savedTrades).toHaveLength(1);
  });

  it('counts the trades already stored when it checks a sale', async () => {
    const stored = {
      id: 'old-buy',
      kind: 'buy',
      tradeDate: '2024-06-01',
      quantity: '5',
      price: '50',
      fee: '0',
      amount: null,
      splitFrom: null,
      splitTo: null,
      acquiredOn: null,
      currency: 'USD',
    };
    const { ctx } = context({ trades: [stored] });
    const results = await new TradesTarget().run(
      [
        row('2025-01-11', 'Sell', 'ACME', '', '5', '60', '', '', '', ''),
        row('2025-01-12', 'Buy', 'ACME', '', '1', '60', '', '', '', 'EUR'),
      ],
      ctx,
      true,
    );
    expect(results[0].status).toBe('created');
    // The holding's trades are in dollars: a euro row would mix two currencies in one basis.
    expect(results[1]).toMatchObject({ status: 'error', reason: 'currency' });
  });

  it('matches by name when the row has no symbol, and says when two holdings fit', async () => {
    const twin = { ...fund, id: 'h-twin', symbol: 'ACME2.US' };
    const { ctx } = context({ holdings: [fund, twin] });
    const results = await new TradesTarget().run(
      [
        row('2025-01-10', 'Buy', '', 'acme fund', '1', '10', '', '', '', ''),
        row('2025-01-10', 'Buy', 'ACME2', '', '1', '10', '', '', '', ''),
      ],
      ctx,
      true,
    );
    expect(results[0]).toMatchObject({ status: 'error', reason: 'holding_ambiguous' });
    expect(results[1].status).toBe('created');
  });

  it('creates a missing holding only when told to, in the chosen account', async () => {
    const rows = [row('2025-01-10', 'Buy', 'NEWCO', 'New Co', '1', '10', '', '', '', 'USD')];
    const refused = context();
    expect((await new TradesTarget().run(rows, refused.ctx, false))[0]).toMatchObject({
      status: 'error',
      reason: 'holding_not_found',
    });

    const allowed = context({ accountId: 'acc-1', create: true });
    const results = await new TradesTarget().run(rows, allowed.ctx, false);
    expect(results[0].status).toBe('created');
    expect(allowed.savedHoldings[0]).toMatchObject({ accountId: 'acc-1', symbol: 'NEWCO.US' });
    expect(allowed.ctx.created).toContainEqual({ kind: 'investment_holding', id: 'h-new-1' });
    // A new holding has nothing to put back on undo.
    expect(allowed.ctx.updated).toEqual([]);
  });

  it('writes nothing on a dry run', async () => {
    const { ctx, savedTrades, savedHoldings, updates } = context({
      accountId: 'acc-1',
      create: true,
    });
    const results = await new TradesTarget().run(
      [row('2025-01-10', 'Buy', 'NEWCO', '', '1', '10', '', '', '', '')],
      ctx,
      true,
    );
    expect(results[0].status).toBe('created');
    expect([savedTrades, savedHoldings, updates, ctx.created]).toEqual([[], [], [], []]);
  });

  it('prices a buy from its amount when the sheet has no price', async () => {
    const { ctx, savedTrades } = context();
    await new TradesTarget().run(
      [row('2025-01-10', 'Buy', 'ACME', '', '4', '', '', '-200', '', '')],
      ctx,
      false,
    );
    expect(savedTrades[0]).toMatchObject({ quantity: 4, price: 50 });
  });

  it('names what is missing: kind, date, ratio', async () => {
    const { ctx } = context();
    const results = await new TradesTarget().run(
      [
        row('2025-01-10', 'Swap', 'ACME', '', '1', '1', '', '', '', ''),
        row('someday', 'Buy', 'ACME', '', '1', '1', '', '', '', ''),
        row('2025-01-10', 'Split', 'ACME', '', '', '', '', '', 'lots', ''),
      ],
      ctx,
      true,
    );
    expect(results.map(item => item.reason)).toEqual(['kind', 'date', 'ratio']);
  });

  it('matches a bare ticker to the one holding with it on any market', async () => {
    const listed = { ...fund, id: 'h-de', symbol: 'ACMEW.DE' };
    const { ctx } = context({ holdings: [listed] });
    const results = await new TradesTarget().run(
      [
        row('2025-01-10', 'Buy', 'acmew', '', '1', '10', '', '', '', ''),
        row('2025-01-10', 'Buy', 'ACMEW.L', '', '1', '10', '', '', '', ''),
      ],
      ctx,
      true,
    );
    expect(results[0].status).toBe('created');
    // A market the sheet names is taken at its word.
    expect(results[1]).toMatchObject({ status: 'error', reason: 'holding_not_found' });
  });

  it('leaves metal lots to the metals import', async () => {
    const lot = { ...fund, id: 'h-gold', symbol: null, name: 'Gold bar', assetClass: 'metal' };
    const { ctx } = context({ holdings: [lot] });
    const results = await new TradesTarget().run(
      [row('2025-01-10', 'Buy', '', 'Gold bar', '1', '1', '', '', '', '')],
      ctx,
      true,
    );
    expect(results[0]).toMatchObject({ status: 'error', reason: 'holding_not_found' });
  });
});

describe('parseRatio', () => {
  it.each([
    ['3:1', { to: 3, from: 1 }],
    ['3 for 1', { to: 3, from: 1 }],
    ['1-for-10', { to: 1, from: 10 }],
    ['1/10', { to: 1, from: 10 }],
    ['3,5:1', { to: 3.5, from: 1 }],
  ])('reads %s', (raw, expected) => {
    expect(parseRatio(raw)).toEqual(expected);
  });

  it('refuses what is not a ratio', () => {
    expect(parseRatio('0:1')).toBeNull();
    expect(parseRatio('three')).toBeNull();
  });
});
