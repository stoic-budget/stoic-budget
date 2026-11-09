vi.mock('franc', () => ({
  franc: () => 'und',
}));

import { type INestApplication, ValidationPipe } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import {
  deleteUserByEmail,
  type E2eAccount,
  e2eTestingModule,
  registerAccount,
} from './helpers/e2e-app';

/**
 * Trades behind a holding: they set its quantity, carry the cost basis into
 * lots and realised gains, stay inside their workspace, and import from a
 * broker's sheet with a dry run and an undo. A holding without trades keeps
 * working as a typed-in snapshot.
 */
describe('Investment trades (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const stamp = Date.now();
  const emails = {
    owner: `trades-owner-${stamp}@example.com`,
    other: `trades-other-${stamp}@example.com`,
  };
  let owner: E2eAccount;
  let other: E2eAccount;
  let accountId: string;
  let holdingId: string;
  let buyId: string;
  let sellId: string;
  let expenseId: string;

  const as = (account: E2eAccount, req: request.Test) =>
    req.set('Authorization', `Bearer ${account.token}`).set('x-workspace-id', account.workspaceId);
  const server = () => app.getHttpServer();
  const call = (account: E2eAccount, method: 'get' | 'post' | 'patch' | 'delete', url: string) =>
    as(account, request(server())[method](url));
  const holding = async (id: string) => {
    const accounts = await call(owner, 'get', '/investments').expect(200);
    return accounts.body
      .flatMap((account: { holdings: Array<{ id: string }> }) => account.holdings)
      .find((row: { id: string }) => row.id === id);
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await e2eTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    dataSource = moduleFixture.get<DataSource>(DataSource);

    owner = await registerAccount(app, emails.owner, 'Member One');
    other = await registerAccount(app, emails.other, 'Member Two');
    await call(owner, 'patch', `/workspaces/${owner.workspaceId}`).send({ currency: 'USD' }).expect(200);
    const account = await call(owner, 'post', '/investments/accounts')
      .send({ name: 'ACME Brokerage', kind: 'investment' })
      .expect(201);
    accountId = account.body.id;

    const categories = await call(owner, 'get', '/categories?type=expense').expect(200);
    const statement = await call(owner, 'post', '/statements/manual-expense')
      .field('amount', '1001')
      .field('currency', 'USD')
      .field('merchant', 'ACME Brokerage top-up')
      .field('categoryId', categories.body[0].id)
      .field('date', '2025-01-10')
      .expect(201);
    const listed = await call(owner, 'get', `/transactions?statementId=${statement.body.id}`).expect(
      200,
    );
    expenseId = listed.body.data[0].id;
  });

  afterAll(async () => {
    if (dataSource) {
      for (const email of Object.values(emails)) {
        await deleteUserByEmail(dataSource, email);
      }
    }
    await app.close();
  });

  it('keeps a holding without trades a typed-in snapshot', async () => {
    const created = await call(owner, 'post', `/investments/accounts/${accountId}/holdings`)
      .send({ name: 'ACME Bond Fund', assetClass: 'bond', quantity: 3, price: 50, priceCurrency: 'USD' })
      .expect(201);
    expect(created.body).toMatchObject({ quantity: 3, value: 150, hasTrades: false });
    const edited = await call(owner, 'patch', `/investments/holdings/${created.body.id}`)
      .send({ quantity: 5 })
      .expect(200);
    expect(edited.body).toMatchObject({ quantity: 5, value: 250, hasTrades: false });
    const lots = await call(owner, 'get', `/investments/holdings/${created.body.id}/lots`).expect(200);
    expect(lots.body).toMatchObject({ currency: null, quantity: 0, openLots: [], sales: [] });
    await call(owner, 'delete', `/investments/holdings/${created.body.id}`).expect(204);
  });

  it('derives the quantity from buys and sells, fees in the basis', async () => {
    const created = await call(owner, 'post', `/investments/accounts/${accountId}/holdings`)
      .send({ name: 'ACME World ETF', assetClass: 'etf', quantity: 0, price: 130, priceCurrency: 'USD' })
      .expect(201);
    holdingId = created.body.id;

    const buy = await call(owner, 'post', `/investments/holdings/${holdingId}/trades`)
      .send({ kind: 'buy', date: '2025-01-10', quantity: 10, price: 100, fee: 1, transactionId: expenseId })
      .expect(201);
    buyId = buy.body.id;
    expect(buy.body).toMatchObject({
      kind: 'buy',
      date: '2025-01-10',
      quantity: 10,
      price: 100,
      fee: 1,
      currency: 'USD',
      transactionId: expenseId,
      amount: null,
    });
    const sell = await call(owner, 'post', `/investments/holdings/${holdingId}/trades`)
      .send({ kind: 'sell', date: '2025-03-10', quantity: 4, price: 120, fee: 2 })
      .expect(201);
    sellId = sell.body.id;

    expect(await holding(holdingId)).toMatchObject({ quantity: 6, value: 780, hasTrades: true });
    const lots = await call(owner, 'get', `/investments/holdings/${holdingId}/lots`).expect(200);
    // 4 × 120 − 2 = 478 against 4 × 100.1 = 400.4.
    expect(lots.body).toMatchObject({
      method: 'fifo',
      currency: 'USD',
      quantity: 6,
      costBasis: 600.6,
      realizedGain: 77.6,
      fees: 3,
      marketValue: 780,
      unrealizedGain: 179.4,
    });
    expect(lots.body.sales[0]).toMatchObject({ tradeId: sellId, proceeds: 478, cost: 400.4 });
    expect(lots.body.years).toEqual([{ year: 2025, realizedGain: 77.6, dividends: 0 }]);
  });

  it('refuses a typed quantity, an oversell, and a change that would uncover a sale', async () => {
    const typed = await call(owner, 'patch', `/investments/holdings/${holdingId}`)
      .send({ quantity: 99 })
      .expect(400);
    expect(typed.body.error.code).toBe('INVESTMENTS_QUANTITY_FROM_TRADES');

    const oversell = await call(owner, 'post', `/investments/holdings/${holdingId}/trades`)
      .send({ kind: 'sell', date: '2025-04-01', quantity: 7, price: 1 })
      .expect(400);
    expect(oversell.body.error.code).toBe('INVESTMENTS_TRADE_EXCEEDS_HOLDING');
    const shrink = await call(owner, 'patch', `/investments/trades/${buyId}`)
      .send({ quantity: 3 })
      .expect(400);
    expect(shrink.body.error.code).toBe('INVESTMENTS_TRADE_EXCEEDS_HOLDING');
    const earlier = await call(owner, 'patch', `/investments/trades/${sellId}`)
      .send({ date: '2025-01-01' })
      .expect(400);
    expect(earlier.body.error.code).toBe('INVESTMENTS_TRADE_EXCEEDS_HOLDING');
    await call(owner, 'delete', `/investments/trades/${buyId}`).expect(400);

    const euros = await call(owner, 'post', `/investments/holdings/${holdingId}/trades`)
      .send({ kind: 'buy', date: '2025-04-01', quantity: 1, price: 1, currency: 'EUR' })
      .expect(400);
    expect(euros.body.error.code).toBe('INVESTMENTS_TRADE_CURRENCY_MISMATCH');
    const noAmount = await call(owner, 'post', `/investments/holdings/${holdingId}/trades`)
      .send({ kind: 'dividend', date: '2025-04-01' })
      .expect(400);
    expect(noAmount.body.error.code).toBe('INVESTMENTS_TRADE_AMOUNT_REQUIRED');
    expect(await holding(holdingId)).toMatchObject({ quantity: 6 });
  });

  it('splits, pays dividends, and switches to average cost', async () => {
    await call(owner, 'post', `/investments/holdings/${holdingId}/trades`)
      .send({ kind: 'split', date: '2025-05-01', splitFrom: 1, splitTo: 3 })
      .expect(201);
    const dividend = await call(owner, 'post', `/investments/holdings/${holdingId}/trades`)
      .send({ kind: 'dividend', date: '2025-06-30', amount: 12, fee: 2, quantity: 5, price: 9 })
      .expect(201);
    // A dividend has no units: what the form left in those fields is dropped.
    expect(dividend.body).toMatchObject({ quantity: 0, price: 0, amount: 12, fee: 2 });
    expect(await holding(holdingId)).toMatchObject({ quantity: 18 });
    // A second lot, dearer, so FIFO and average cost part ways.
    await call(owner, 'post', `/investments/holdings/${holdingId}/trades`)
      .send({ kind: 'buy', date: '2025-07-01', quantity: 2, price: 60 })
      .expect(201);
    await call(owner, 'post', `/investments/holdings/${holdingId}/trades`)
      .send({ kind: 'sell', date: '2025-08-01', quantity: 18, price: 50 })
      .expect(201);

    const fifo = await call(owner, 'get', `/investments/holdings/${holdingId}/lots`).expect(200);
    expect(fifo.body).toMatchObject({ quantity: 2, dividends: 10 });
    // FIFO sold the 18 split shares (600.6) and kept the 2 bought at 60.
    expect(fifo.body.costBasis).toBe(120);

    const settings = await call(owner, 'patch', '/investments/settings')
      .send({ basisMethod: 'average' })
      .expect(200);
    expect(settings.body).toEqual({ basisMethod: 'average' });
    const average = await call(owner, 'get', `/investments/holdings/${holdingId}/lots`).expect(200);
    expect(average.body.method).toBe('average');
    // Pool of 720.6 for 20 units: what stays is two units at the average, 72.06.
    expect(average.body.costBasis).toBe(72.06);
    expect(average.body.realizedGain).not.toBe(fifo.body.realizedGain);
    await call(owner, 'patch', '/investments/settings').send({ basisMethod: 'fifo' }).expect(200);

    const list = await call(owner, 'get', `/investments/holdings/${holdingId}/trades`).expect(200);
    expect(list.body.map((trade: { kind: string }) => trade.kind)).toEqual([
      'buy',
      'sell',
      'split',
      'dividend',
      'buy',
      'sell',
    ]);
  });

  it('counts trades as the account flows when no bank row is linked', async () => {
    const accounts = await call(owner, 'get', '/investments').expect(200);
    const account = accounts.body.find((row: { id: string }) => row.id === accountId);
    // Buys 1001 + 120 in, sales 478 + 900 out, a net dividend of 10.
    expect(account).toMatchObject({ contributed: 1121, withdrawn: 1378, income: 10 });
    const returns = await call(owner, 'get', '/investments/returns?range=all').expect(200);
    const source = returns.body.sources.find((row: { id: string }) => row.id === accountId);
    expect(source.flags).not.toContain('no_contributions');
    expect(source.contributions).toBe(1121);
  });

  it('keeps the trade when its linked bank row is deleted', async () => {
    await dataSource.query('DELETE FROM transactions WHERE id = $1', [expenseId]);
    const list = await call(owner, 'get', `/investments/holdings/${holdingId}/trades`).expect(200);
    const buy = list.body.find((trade: { id: string }) => trade.id === buyId);
    expect(buy.transactionId).toBeNull();
  });

  it('keeps trades inside their workspace', async () => {
    await call(other, 'get', `/investments/holdings/${holdingId}/trades`).expect(404);
    await call(other, 'get', `/investments/holdings/${holdingId}/lots`).expect(404);
    await call(other, 'post', `/investments/holdings/${holdingId}/trades`)
      .send({ kind: 'buy', date: '2025-01-01', quantity: 1, price: 1 })
      .expect(404);
    await call(other, 'patch', `/investments/trades/${buyId}`).send({ quantity: 100 }).expect(404);
    await call(other, 'delete', `/investments/trades/${buyId}`).expect(404);

    // The other workspace's bank row cannot be named as a cash leg.
    const categories = await call(other, 'get', '/categories?type=expense').expect(200);
    const statement = await call(other, 'post', '/statements/manual-expense')
      .field('amount', '5')
      .field('currency', 'USD')
      .field('merchant', 'Example Shop')
      .field('categoryId', categories.body[0].id)
      .field('date', '2025-01-10')
      .expect(201);
    const rows = await call(other, 'get', `/transactions?statementId=${statement.body.id}`).expect(200);
    const foreign = await call(owner, 'patch', `/investments/trades/${buyId}`)
      .send({ transactionId: rows.body.data[0].id })
      .expect(404);
    expect(foreign.body.error.code).toBe('INVESTMENTS_TRANSACTION_NOT_FOUND');
    const [{ count }] = await dataSource.query(
      'SELECT count(*)::int AS count FROM investment_trades WHERE workspace_id = $1',
      [other.workspaceId],
    );
    expect(count).toBe(0);
  });

  it('imports a broker sheet: dry run, commit, undo', async () => {
    const snapshot = await call(owner, 'post', `/investments/accounts/${accountId}/holdings`)
      .send({ symbol: 'ACMEB', name: 'ACME Bonds', assetClass: 'bond', quantity: 7, price: 10, priceCurrency: 'USD' })
      .expect(201);
    const body = {
      target: 'trades',
      mapping: { date: 0, kind: 1, symbol: 2, quantity: 3, price: 4, fee: 5 },
      rows: [
        ['2025-02-01', 'Buy', 'ACMEB', '5', '10', '0.5'],
        ['2025-02-02', 'Sell', 'ACMEB', '9', '11', ''],
        ['2025-02-03', 'Buy', 'NEWCO', '1', '20', ''],
      ],
      options: { currency: 'USD', investmentAccountId: accountId },
    };
    const dry = await call(owner, 'post', '/entity-imports').send({ ...body, dryRun: true }).expect(201);
    expect(dry.body.counts).toEqual({ created: 1, updated: 0, skipped: 0, errors: 2 });
    expect(dry.body.rows.map((row: { reason?: string }) => row.reason ?? null)).toEqual([
      null,
      'exceeds_holding',
      'holding_not_found',
    ]);
    expect(await holding(snapshot.body.id)).toMatchObject({ quantity: 7, hasTrades: false });

    const run = await call(owner, 'post', '/entity-imports')
      .send({ ...body, options: { ...body.options, createMissingHoldings: true } })
      .expect(201);
    expect(run.body.counts.created).toBe(2);
    expect(await holding(snapshot.body.id)).toMatchObject({ quantity: 5, hasTrades: true });
    const accounts = await call(owner, 'get', '/investments').expect(200);
    const created = accounts.body
      .flatMap((account: { holdings: Array<{ symbol: string | null }> }) => account.holdings)
      .find((row: { symbol: string | null }) => row.symbol === 'NEWCO.US');
    expect(created).toMatchObject({ quantity: 1, hasTrades: true });

    await call(owner, 'delete', `/entity-imports/${run.body.batchId}`).expect(200);
    expect(await holding(snapshot.body.id)).toMatchObject({ quantity: 7, hasTrades: false });
    expect(await holding(created.id)).toBeUndefined();
  });

  it('refuses an undo that would leave a later sale uncovered', async () => {
    const created = await call(owner, 'post', `/investments/accounts/${accountId}/holdings`)
      .send({ symbol: 'ACMEC', name: 'ACME Corp', assetClass: 'stock', price: 10, priceCurrency: 'USD' })
      .expect(201);
    const run = await call(owner, 'post', '/entity-imports')
      .send({
        target: 'trades',
        mapping: { date: 0, kind: 1, symbol: 2, quantity: 3, price: 4 },
        rows: [['2025-02-01', 'Buy', 'ACMEC', '5', '10']],
        options: { currency: 'USD' },
      })
      .expect(201);
    await call(owner, 'post', `/investments/holdings/${created.body.id}/trades`)
      .send({ kind: 'sell', date: '2025-03-01', quantity: 5, price: 12 })
      .expect(201);
    const undo = await call(owner, 'delete', `/entity-imports/${run.body.batchId}`).expect(400);
    expect(undo.body.error.code).toBe('INVESTMENTS_TRADE_EXCEEDS_HOLDING');
    expect(await holding(created.body.id)).toMatchObject({ quantity: 0, hasTrades: true });
  });

  it('rewrites the account value when an undo deletes the holdings an import created', async () => {
    const account = await call(owner, 'post', '/investments/accounts')
      .send({ name: 'ACME Undo Brokerage', kind: 'investment' })
      .expect(201);
    const run = await call(owner, 'post', '/entity-imports')
      .send({
        target: 'trades',
        mapping: { date: 0, kind: 1, name: 2, quantity: 3, price: 4 },
        rows: [['2025-02-01', 'Buy', 'ACME Manual Fund', '5', '10']],
        options: { currency: 'USD', investmentAccountId: account.body.id, createMissingHoldings: true },
      })
      .expect(201);
    const [created] = (await call(owner, 'get', '/investments').expect(200)).body.find(
      (row: { id: string }) => row.id === account.body.id,
    ).holdings;
    await call(owner, 'patch', `/investments/holdings/${created.id}`).send({ price: 10 }).expect(200);
    const value = async () => {
      const [row] = await dataSource.query(
        `SELECT amount::float AS amount FROM balance_snapshots
          WHERE workspace_id = $1 AND account_id = $2 ORDER BY snapshot_date DESC LIMIT 1`,
        [owner.workspaceId, account.body.id],
      );
      return row?.amount;
    };
    expect(await value()).toBe(50);

    await call(owner, 'delete', `/entity-imports/${run.body.batchId}`).expect(200);
    expect(await holding(created.id)).toBeUndefined();
    // Net worth reads the snapshot: it must not keep counting the deleted holding.
    expect(await value()).toBe(0);
  });

  it('keeps a holding an import created when trades were entered on it since', async () => {
    const run = await call(owner, 'post', '/entity-imports')
      .send({
        target: 'trades',
        mapping: { date: 0, kind: 1, name: 2, quantity: 3, price: 4 },
        rows: [['2025-02-01', 'Buy', 'ACME Kept Fund', '5', '10']],
        options: { currency: 'USD', investmentAccountId: accountId, createMissingHoldings: true },
      })
      .expect(201);
    const accounts = await call(owner, 'get', '/investments').expect(200);
    const created = accounts.body
      .flatMap((row: { holdings: Array<{ name: string }> }) => row.holdings)
      .find((row: { name: string }) => row.name === 'ACME Kept Fund');
    const manual = await call(owner, 'post', `/investments/holdings/${created.id}/trades`)
      .send({ kind: 'buy', date: '2025-03-01', quantity: 2, price: 10, note: 'typed by hand' })
      .expect(201);

    const undo = await call(owner, 'delete', `/entity-imports/${run.body.batchId}`).expect(200);
    expect(undo.body).toMatchObject({ undone: true, removed: 1 });
    const list = await call(owner, 'get', `/investments/holdings/${created.id}/trades`).expect(200);
    expect(list.body.map((trade: { id: string }) => trade.id)).toEqual([manual.body.id]);
    // The import's buy is gone, the hand-entered one stays and says what is held.
    expect(await holding(created.id)).toMatchObject({ quantity: 2, hasTrades: true });
  });

  it('leaves a typed-in quantity alone when only dividends are recorded', async () => {
    const typed = await call(owner, 'post', `/investments/accounts/${accountId}/holdings`)
      .send({ symbol: 'ACMED', name: 'ACME Dividend Co', assetClass: 'stock', quantity: 7, price: 10, priceCurrency: 'USD' })
      .expect(201);
    const body = {
      target: 'trades',
      // A broker's dividend report: the quantity column is there, and empty.
      mapping: { date: 0, kind: 1, symbol: 2, quantity: 3, amount: 4 },
      rows: [['2025-02-01', 'Dividend', 'ACMED', '', '4']],
      options: { currency: 'USD', investmentAccountId: accountId },
    };
    const dry = await call(owner, 'post', '/entity-imports').send({ ...body, dryRun: true });
    expect(dry.body).toMatchObject({ counts: { created: 1, errors: 0 } });
    await call(owner, 'post', '/entity-imports').send(body).expect(201);
    expect(await holding(typed.body.id)).toMatchObject({ quantity: 7, value: 70, hasTrades: false });

    // By hand, the same: a dividend is income on what is held, not a count of it.
    await call(owner, 'post', `/investments/holdings/${typed.body.id}/trades`)
      .send({ kind: 'dividend', date: '2025-03-01', amount: 3 })
      .expect(201);
    expect(await holding(typed.body.id)).toMatchObject({ quantity: 7, value: 70, hasTrades: false });
    // Still typed in: it can be corrected.
    await call(owner, 'patch', `/investments/holdings/${typed.body.id}`).send({ quantity: 8 }).expect(200);
    const lots = await call(owner, 'get', `/investments/holdings/${typed.body.id}/lots`).expect(200);
    expect(lots.body).toMatchObject({ quantity: 8, marketValue: 80, unrealizedGain: null, dividends: 7 });

    // The first buy is where the trades take over.
    await call(owner, 'post', `/investments/holdings/${typed.body.id}/trades`)
      .send({ kind: 'buy', date: '2025-04-01', quantity: 2, price: 10 })
      .expect(201);
    expect(await holding(typed.body.id)).toMatchObject({ quantity: 2, hasTrades: true });
  });

  it('answers 400, not 500, for a currency that is too short once trimmed', async () => {
    const padded = await call(owner, 'post', `/investments/holdings/${holdingId}/trades`)
      .send({ kind: 'buy', date: '2025-01-01', quantity: 1, price: 1, currency: ' ab ' })
      .expect(400);
    expect(padded.body.error.code).toBe('REQUEST_INVALID');
  });

  it('moves a quoted price through a split recorded after the quote, and back', async () => {
    const created = await call(owner, 'post', `/investments/accounts/${accountId}/holdings`)
      .send({ name: 'ACME Split Co', assetClass: 'stock', price: 200, priceCurrency: 'USD' })
      .expect(201);
    const id = created.body.id;
    await call(owner, 'post', `/investments/holdings/${id}/trades`)
      .send({ kind: 'buy', date: '2024-06-01', quantity: 5, price: 150 })
      .expect(201);
    // The price was typed in before the split.
    await dataSource.query('UPDATE investment_holdings SET priced_at = $2 WHERE id = $1', [
      id,
      '2025-01-01T12:00:00Z',
    ]);
    const split = await call(owner, 'post', `/investments/holdings/${id}/trades`)
      .send({ kind: 'split', date: '2025-05-01', splitFrom: 1, splitTo: 2 })
      .expect(201);
    // Twice the shares at half the price: the holding is worth what it was.
    expect(await holding(id)).toMatchObject({ quantity: 10, price: 100, value: 1000 });
    await call(owner, 'patch', `/investments/trades/${split.body.id}`)
      .send({ splitTo: 4 })
      .expect(200);
    expect(await holding(id)).toMatchObject({ quantity: 20, price: 50, value: 1000 });
    await call(owner, 'delete', `/investments/trades/${split.body.id}`).expect(204);
    expect(await holding(id)).toMatchObject({ quantity: 5, price: 200, value: 1000 });

    // A split before the quote is already in the price.
    await call(owner, 'post', `/investments/holdings/${id}/trades`)
      .send({ kind: 'split', date: '2024-12-01', splitFrom: 1, splitTo: 2 })
      .expect(201);
    expect(await holding(id)).toMatchObject({ quantity: 10, price: 200 });
  });

  it('leaves metal lots out of trades', async () => {
    const lot = await call(owner, 'post', '/metals/lots')
      .send({ metal: 'XAU', quantity: 1, unitWeight: 1, weightUnit: 'ozt', purity: 0.9999 })
      .expect(201);
    const refused = await call(owner, 'post', `/investments/holdings/${lot.body.id}/trades`)
      .send({ kind: 'buy', date: '2025-01-01', quantity: 1, price: 1 })
      .expect(400);
    expect(refused.body.error.code).toBe('INVESTMENTS_TRADES_NOT_FOR_METALS');
  });

  it('takes the trades away with their holding', async () => {
    await call(owner, 'delete', `/investments/holdings/${holdingId}`).expect(204);
    const [{ count }] = await dataSource.query(
      'SELECT count(*)::int AS count FROM investment_trades WHERE holding_id = $1',
      [holdingId],
    );
    expect(count).toBe(0);
  });
});
