vi.mock('franc', () => ({
  franc: () => 'und',
}));

import { type INestApplication, ValidationPipe } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { SecurityPricesService } from '../../src/modules/investments/security-prices.service';
import { StockPriceService } from '../../src/modules/investments/stock-price.service';
import {
  deleteUserByEmail,
  type E2eAccount,
  e2eTestingModule,
  registerAccount,
} from './helpers/e2e-app';

const DAY_MS = 86_400_000;
const daysAgo = (days: number) => new Date(Date.now() - days * DAY_MS).toISOString().slice(0, 10);

/**
 * Daily closes: the feed's are shared by every workspace holding the symbol,
 * a workspace's own (typed in or imported) change its figures only. The feed
 * is never reached: Yahoo's answer is replaced by closes made up here.
 */
describe('Price history (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const stamp = Date.now();
  // A symbol of this run only: the feed's tables are shared by every suite.
  const ticker = `PH${String(stamp).slice(-8)}`;
  const symbol = `${ticker}.US`;
  const emails = {
    a: `prices-a-${stamp}@example.com`,
    b: `prices-b-${stamp}@example.com`,
  };
  let a: E2eAccount;
  let b: E2eAccount;
  const holdings: Record<'a' | 'b', string> = { a: '', b: '' };
  let accountA = '';
  let fetchCloses: ReturnType<typeof vi.spyOn>;
  /**
   * Every day from 240 days ago to yesterday at 100; the feed's answer. Short
   * enough that the chart keeps every day (it thins out past 250).
   */
  const feedCloses = Array.from({ length: 240 }, (_, index) => ({
    date: daysAgo(240 - index),
    close: 100,
  }));
  const MANUAL_DAY = daysAgo(10);

  const as = (account: E2eAccount, req: request.Test) =>
    req.set('Authorization', `Bearer ${account.token}`).set('x-workspace-id', account.workspaceId);
  const call = (account: E2eAccount, method: 'get' | 'post' | 'patch' | 'delete', url: string) =>
    as(account, request(app.getHttpServer())[method](url));
  const history = async (account: E2eAccount, holdingId: string) =>
    (await call(account, 'get', `/investments/holdings/${holdingId}/history`).expect(200)).body;
  const closeOn = (body: { points: Array<{ date: string; close: number | null }> }, date: string) =>
    body.points.find(point => point.date === date)?.close;
  const healthOf = async (account: E2eAccount, holdingId: string) => {
    const accounts = await call(account, 'get', '/investments').expect(200);
    return accounts.body
      .flatMap((row: { holdings: Array<{ id: string }> }) => row.holdings)
      .find((row: { id: string }) => row.id === holdingId).priceHealth;
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await e2eTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    dataSource = moduleFixture.get<DataSource>(DataSource);
    const stock = app.get(StockPriceService, { strict: false });
    fetchCloses = vi
      .spyOn(stock, 'fetchDailyCloses')
      .mockImplementation(async () => ({ currency: 'USD', closes: feedCloses }));
    vi.spyOn(stock, 'getPrices').mockImplementation(async () => new Map());

    a = await registerAccount(app, emails.a, 'Member One');
    b = await registerAccount(app, emails.b, 'Member Two');
    for (const [key, account] of [
      ['a', a],
      ['b', b],
    ] as const) {
      await call(account, 'patch', `/workspaces/${account.workspaceId}`)
        .send({ currency: 'USD' })
        .expect(200);
      const created = await call(account, 'post', '/investments/accounts')
        .send({ name: 'ACME Brokerage' })
        .expect(201);
      if (key === 'a') accountA = created.body.id;
      const holding = await call(account, 'post', `/investments/accounts/${created.body.id}/holdings`)
        .send({ symbol: ticker, name: 'ACME Corp', assetClass: 'stock', quantity: 1, price: 100 })
        .expect(201);
      holdings[key] = holding.body.id;
    }
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    if (dataSource) {
      for (const email of Object.values(emails)) await deleteUserByEmail(dataSource, email);
      await dataSource.query('DELETE FROM security_prices WHERE symbol = $1', [symbol]);
      await dataSource.query('DELETE FROM security_price_symbols WHERE symbol = $1', [symbol]);
    }
    await app.close();
  });

  it('backfills a symbol on first use, once, for every workspace that holds it', async () => {
    expect((await healthOf(a, holdings.a)).status).toBe('pending');

    const first = await history(a, holdings.a);

    expect(fetchCloses).toHaveBeenCalledTimes(1);
    expect(fetchCloses).toHaveBeenCalledWith(symbol, '10y');
    expect(first).toMatchObject({ symbol, basis: 'none', firstCloseOn: feedCloses[0].date });
    expect(first.health).toMatchObject({ status: 'ok', lastCloseOn: daysAgo(1), failures: 0 });
    const stored = await dataSource.query(
      'SELECT COUNT(*)::int AS count FROM security_prices WHERE symbol = $1',
      [symbol],
    );
    expect(stored[0].count).toBe(feedCloses.length);

    const other = await history(b, holdings.b);
    expect(fetchCloses).toHaveBeenCalledTimes(1);
    expect(closeOn(other, MANUAL_DAY)).toBe(100);
  });

  it('a close typed in changes its own workspace only', async () => {
    const typed = await call(a, 'post', `/investments/holdings/${holdings.a}/closes`)
      .send({ date: MANUAL_DAY, close: 150 })
      .expect(201);
    expect(typed.body).toMatchObject({ symbol, date: MANUAL_DAY, close: 150, source: 'manual' });
    // Typing the same day again replaces it.
    await call(a, 'post', `/investments/holdings/${holdings.a}/closes`)
      .send({ date: MANUAL_DAY, close: 155 })
      .expect(201);

    expect(closeOn(await history(a, holdings.a), MANUAL_DAY)).toBe(155);
    expect(closeOn(await history(b, holdings.b), MANUAL_DAY)).toBe(100);
    const listed = await call(a, 'get', `/investments/holdings/${holdings.a}/closes`).expect(200);
    expect(listed.body).toHaveLength(1);
    expect((await call(b, 'get', `/investments/holdings/${holdings.b}/closes`).expect(200)).body).toEqual([]);
    const feed = await dataSource.query(
      'SELECT close FROM security_prices WHERE symbol = $1 AND price_date = $2',
      [symbol, MANUAL_DAY],
    );
    expect(Number(feed[0].close)).toBe(100);
  });

  it('another workspace can neither read, add to nor delete a workspace\'s closes', async () => {
    const own = (await call(a, 'get', `/investments/holdings/${holdings.a}/closes`).expect(200)).body;

    await call(b, 'get', `/investments/holdings/${holdings.a}/closes`).expect(404);
    await call(b, 'get', `/investments/holdings/${holdings.a}/history`).expect(404);
    await call(b, 'post', `/investments/holdings/${holdings.a}/closes`)
      .send({ date: MANUAL_DAY, close: 1 })
      .expect(404);
    await call(b, 'post', `/investments/holdings/${holdings.a}/closes/import`)
      .send({ csv: `${MANUAL_DAY},1` })
      .expect(404);
    await call(b, 'delete', `/investments/closes/${own[0].id}`).expect(404);

    const after = (await call(a, 'get', `/investments/holdings/${holdings.a}/closes`).expect(200)).body;
    expect(after).toEqual(own);
  });

  it('imports closes from a file, replaces the days it has, and says what it skipped', async () => {
    const csv = ['Date,Close', `${daysAgo(20)},120`, `${daysAgo(21)},"121.5"`, 'soon,1', `${MANUAL_DAY},160`].join(
      '\n',
    );

    const first = await call(a, 'post', `/investments/holdings/${holdings.a}/closes/import`)
      .send({ csv })
      .expect(200);
    expect(first.body).toEqual({
      created: 2,
      updated: 1,
      skipped: [{ line: 4, reason: 'unreadable_date' }],
    });
    // The same file again adds nothing: every day is already there.
    const again = await call(a, 'post', `/investments/holdings/${holdings.a}/closes/import`)
      .send({ csv })
      .expect(200);
    expect(again.body).toMatchObject({ created: 0, updated: 3 });
    const rows = await dataSource.query(
      'SELECT COUNT(*)::int AS count FROM workspace_security_prices WHERE workspace_id = $1',
      [a.workspaceId],
    );
    expect(rows[0].count).toBe(3);

    const mine = await history(a, holdings.a);
    expect(closeOn(mine, daysAgo(20))).toBe(120);
    expect(closeOn(mine, MANUAL_DAY)).toBe(160);
    expect(closeOn(await history(b, holdings.b), daysAgo(20))).toBe(100);
    const imported = (await call(a, 'get', `/investments/holdings/${holdings.a}/closes`).expect(200)).body;
    expect(imported.map((row: { source: string }) => row.source)).toEqual(['import', 'import', 'import']);
  });

  it('refuses a close dated after today, and one for a holding without a symbol', async () => {
    await call(a, 'post', `/investments/holdings/${holdings.a}/closes`)
      .send({ date: daysAgo(-2), close: 1 })
      .expect(400);
    const plain = await call(a, 'post', `/investments/accounts/${accountA}/holdings`)
      .send({ name: 'ACME Pension Fund', assetClass: 'fund', quantity: 1, price: 10 })
      .expect(201);
    expect(plain.body.priceHealth).toBeNull();
    const refused = await call(a, 'post', `/investments/holdings/${plain.body.id}/closes`)
      .send({ date: MANUAL_DAY, close: 1 })
      .expect(400);
    expect(refused.body.error?.code ?? refused.body.code).toBe('INVESTMENTS_HOLDING_NO_SYMBOL');
    await call(a, 'delete', `/investments/holdings/${plain.body.id}`).expect(204);
  });

  it('marks a symbol stale after failures, and a newer close of its own clears it for one workspace', async () => {
    // The job reaches every symbol held in this database; only ours is answered, and not now.
    fetchCloses.mockImplementation(async () => null);
    const prices = app.get(SecurityPricesService, { strict: false });
    for (let run = 0; run < 5; run += 1) {
      await prices.recordDailyCloses();
    }
    // One fetch per run for the symbol both workspaces hold.
    const asked = fetchCloses.mock.calls.filter(([name]) => name === symbol);
    expect(asked).toHaveLength(5);
    expect(asked.every(([, range]) => range === '1mo')).toBe(true);

    expect(await healthOf(a, holdings.a)).toMatchObject({ status: 'stale', lastCloseOn: daysAgo(1) });
    expect(await healthOf(b, holdings.b)).toMatchObject({ status: 'stale', failures: 5 });

    await call(a, 'post', `/investments/holdings/${holdings.a}/closes`)
      .send({ date: daysAgo(0), close: 101 })
      .expect(201);

    expect(await healthOf(a, holdings.a)).toMatchObject({ status: 'ok', lastCloseOn: daysAgo(0) });
    expect(await healthOf(b, holdings.b)).toMatchObject({ status: 'stale', lastCloseOn: daysAgo(1) });
    // Today's close of its own becomes the holding's price there, and only there.
    const holdingOf = async (account: E2eAccount, id: string) =>
      (await call(account, 'get', '/investments').expect(200)).body
        .flatMap((row: { holdings: Array<{ id: string }> }) => row.holdings)
        .find((row: { id: string }) => row.id === id);
    expect(await holdingOf(a, holdings.a)).toMatchObject({ price: 101, priceSource: 'manual', value: 101 });
    expect(await holdingOf(b, holdings.b)).toMatchObject({ price: 100, value: 100 });
    // An older close typed in later does not take the price back.
    await call(a, 'post', `/investments/holdings/${holdings.a}/closes`)
      .send({ date: daysAgo(3), close: 90 })
      .expect(201);
    expect((await holdingOf(a, holdings.a)).price).toBe(101);

    fetchCloses.mockImplementation(async (name: string) =>
      name === symbol ? { currency: 'USD', closes: feedCloses } : null,
    );
    await prices.recordDailyCloses();
    expect(await healthOf(b, holdings.b)).toMatchObject({ status: 'ok', failures: 0 });
  });

  it('charts value and unrealized gain from the trades, and opens the returns at past prices', async () => {
    const bought = daysAgo(200);
    const statement = await as(a, request(app.getHttpServer()).post('/statements/manual-expense'))
      .field('amount', '900')
      .field('currency', 'USD')
      .field('merchant', 'ACME Brokerage top-up')
      .field('categoryId', (await call(a, 'get', '/categories?type=expense').expect(200)).body[0].id)
      .field('date', bought)
      .expect(201);
    const rows = await call(a, 'get', `/transactions?statementId=${statement.body.id}`).expect(200);
    await call(a, 'post', '/investments/contributions')
      .send({ transactionId: rows.body.data[0].id, accountId: accountA })
      .expect(201);
    await call(a, 'post', `/investments/holdings/${holdings.a}/trades`)
      .send({ kind: 'buy', date: bought, quantity: 10, price: 90 })
      .expect(201);

    const chart = await history(a, holdings.a);
    expect(chart.basis).toBe('trades');
    const day = chart.points.find((point: { date: string }) => point.date === daysAgo(100));
    expect(day).toMatchObject({ quantity: 10, value: 1000, costBasis: 900, unrealizedGain: 100 });

    // Nothing was entered for the account 30 days ago; the trades at that day's close say 1,000.
    const returns = await call(a, 'get', '/investments/returns?range=30d').expect(200);
    const line = returns.body.sources.find((source: { id: string }) => source.id === accountA);
    expect(line.flags).not.toContain('opening_value_unknown');
    expect(line).toMatchObject({ includedInReturn: true, startValue: 1000 });
  });

  it('takes a mistyped close back off the price when it is deleted', async () => {
    const typo = await call(b, 'post', `/investments/holdings/${holdings.b}/closes`)
      .send({ date: daysAgo(0), close: 1500 })
      .expect(201);
    const holdingOf = async () =>
      (await call(b, 'get', '/investments').expect(200)).body
        .flatMap((row: { holdings: Array<{ id: string }> }) => row.holdings)
        .find((row: { id: string }) => row.id === holdings.b);
    expect(await holdingOf()).toMatchObject({ price: 1500, priceSource: 'manual' });

    await call(b, 'delete', `/investments/closes/${typo.body.id}`).expect(204);

    // The feed's newest close is the price again.
    expect(await holdingOf()).toMatchObject({ price: 100, value: 100, priceSource: 'auto' });
  });

  it('leaves the opening unknown when money paid in waited uninvested until a buy inside the window', async () => {
    const accountB = (await call(b, 'get', '/investments').expect(200)).body.find(
      (row: { holdings: Array<{ id: string }> }) => row.holdings.some(holding => holding.id === holdings.b),
    ).id;
    const paidIn = daysAgo(40);
    const statement = await as(b, request(app.getHttpServer()).post('/statements/manual-expense'))
      .field('amount', '900')
      .field('currency', 'USD')
      .field('merchant', 'ACME Brokerage top-up')
      .field('categoryId', (await call(b, 'get', '/categories?type=expense').expect(200)).body[0].id)
      .field('date', paidIn)
      .expect(201);
    const rows = await call(b, 'get', `/transactions?statementId=${statement.body.id}`).expect(200);
    await call(b, 'post', '/investments/contributions')
      .send({ transactionId: rows.body.data[0].id, accountId: accountB })
      .expect(201);
    await call(b, 'post', `/investments/holdings/${holdings.b}/trades`)
      .send({ kind: 'buy', date: daysAgo(20), quantity: 9, price: 100 })
      .expect(201);

    const returns = await call(b, 'get', '/investments/returns?range=30d').expect(200);
    const line = returns.body.sources.find((source: { id: string }) => source.id === accountB);

    // Nothing was held 30 days ago, but the 900 was already in: the trades cannot say what it was worth.
    expect(line.flags).toContain('opening_value_unknown');
    expect(line.includedInReturn).toBe(false);
    expect(returns.body.summary.gain).toBe(0);
  });
});
