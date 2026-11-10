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
 * Classifying holdings and the allocation that adds them up: a fund spread by
 * its breakdown, a share by its own sector and country, a gold lot under
 * commodities; a breakdown only on a fund, gone when the fund stops being one;
 * and none of it reachable from another workspace.
 */
describe('Investment allocation (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const stamp = Date.now();
  const emails = {
    owner: `alloc-owner-${stamp}@example.com`,
    other: `alloc-other-${stamp}@example.com`,
  };
  let owner: E2eAccount;
  let other: E2eAccount;
  let fundId: string;
  let stockId: string;
  let brokerId: string;

  const as = (account: E2eAccount, req: request.Test) =>
    req.set('Authorization', `Bearer ${account.token}`).set('x-workspace-id', account.workspaceId);
  const server = () => app.getHttpServer();
  const classify = (account: E2eAccount, id: string, body: object) =>
    as(account, request(server()).patch(`/investments/holdings/${id}/classification`)).send(body);
  const allocation = async (account: E2eAccount, query: Record<string, string> = {}) =>
    (await as(account, request(server()).get('/investments/allocation').query(query)).expect(200))
      .body;
  const amountOf = (slices: Array<{ key: string; amount: number }>, key: string) =>
    slices.find(slice => slice.key === key)?.amount;

  const FUND_BREAKDOWN = {
    sector: null,
    region: [
      { key: 'north_america', weight: 60 },
      { key: 'europe', weight: 30.5 },
      { key: 'other', weight: 9.5 },
    ],
    country: null,
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await e2eTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    dataSource = moduleFixture.get<DataSource>(DataSource);

    owner = await registerAccount(app, emails.owner, 'Member One');
    other = await registerAccount(app, emails.other, 'Member Two');
    for (const account of [owner, other]) {
      await as(account, request(server()).patch(`/workspaces/${account.workspaceId}`))
        .send({ currency: 'USD' })
        .expect(200);
    }
    const broker = await as(owner, request(server()).post('/investments/accounts'))
      .send({ name: 'ACME Brokerage' })
      .expect(201);
    brokerId = broker.body.id;
    const add = async (body: object) =>
      (
        await as(owner, request(server()).post(`/investments/accounts/${broker.body.id}/holdings`))
          .send({ priceCurrency: 'USD', ...body })
          .expect(201)
      ).body.id as string;
    fundId = await add({ name: 'ACME World ETF', assetClass: 'etf', quantity: 10, price: 100 });
    stockId = await add({ name: 'ACME Corp', assetClass: 'stock', quantity: 3, price: 33.33 });
    await as(owner, request(server()).post('/metals/lots'))
      .send({
        metal: 'XAU',
        quantity: 1,
        unitWeight: 1,
        weightUnit: 'ozt',
        purity: 1,
        price: 2000,
        priceCurrency: 'USD',
      })
      .expect(201);
  });

  afterAll(async () => {
    if (dataSource) {
      for (const email of Object.values(emails)) {
        await deleteUserByEmail(dataSource, email);
      }
    }
    await app.close();
  });

  it('saves a share’s sector, region and country and a fund’s breakdown', async () => {
    const stock = await classify(owner, stockId, {
      sector: 'information_technology',
      region: 'north_america',
      country: 'US',
    }).expect(200);
    expect(stock.body).toMatchObject({
      sector: 'information_technology',
      region: 'north_america',
      country: 'US',
      lookThrough: null,
      value: 99.99,
    });

    const fund = await classify(owner, fundId, {
      country: 'IE',
      lookThrough: FUND_BREAKDOWN,
    }).expect(200);
    expect(fund.body).toMatchObject({ country: 'IE', sector: null, lookThrough: FUND_BREAKDOWN });

    // The list reads the same thing back.
    const accounts = await as(owner, request(server()).get('/investments')).expect(200);
    const listed = accounts.body[0].holdings.find((item: { id: string }) => item.id === fundId);
    expect(listed.lookThrough).toEqual(FUND_BREAKDOWN);
  });

  it('adds every cut up to the same total, the fund spread by its weights', async () => {
    const body = await allocation(owner);
    expect(body).toMatchObject({ currency: 'USD', total: 3099.99, unvalued: 0 });
    // Region: the fund by its breakdown, the share by its own region, gold unclassified.
    expect(amountOf(body.regions, 'north_america')).toBe(600 + 99.99);
    expect(amountOf(body.regions, 'europe')).toBe(305);
    expect(amountOf(body.regions, 'other')).toBe(95);
    expect(amountOf(body.regions, 'unclassified')).toBe(2000);
    // Country: no country breakdown, so the fund's own country takes all of it.
    expect(amountOf(body.countries, 'IE')).toBe(1000);
    expect(amountOf(body.countries, 'US')).toBe(99.99);
    expect(amountOf(body.sectors, 'information_technology')).toBe(99.99);
    expect(amountOf(body.sectors, 'unclassified')).toBe(3000);
    for (const cut of [body.classes, body.sectors, body.regions, body.countries]) {
      const sum = cut.reduce((total: number, slice: { amount: number }) => total + slice.amount, 0);
      expect(Math.round(sum * 100)).toBe(309_999);
    }
    expect(body.classes).toEqual([
      {
        key: 'commodities',
        amount: 2000,
        percent: 64.52,
        subclasses: [{ key: 'gold', amount: 2000, percent: 64.52 }],
      },
      {
        key: 'equity',
        amount: 1099.99,
        percent: 35.48,
        subclasses: [
          { key: 'etf', amount: 1000, percent: 32.26 },
          { key: 'stock', amount: 99.99, percent: 3.23 },
        ],
      },
    ]);
  });

  it('leaves out an account the net-worth page leaves out, as its asset classes do', async () => {
    const body = await allocation(owner, { exclude: brokerId });
    expect(body).toMatchObject({ total: 2000, unvalued: 0 });
    expect(body.classes.map((slice: { key: string }) => slice.key)).toEqual(['commodities']);
    expect(body.regions).toEqual([{ key: 'unclassified', amount: 2000, percent: 100 }]);
    const netWorth = await as(owner, request(server()).get('/reports/net-worth'))
      .query({ exclude: brokerId })
      .expect(200);
    const classTotal = netWorth.body.byAssetClass.reduce(
      (total: number, item: { amount: number }) => total + item.amount,
      0,
    );
    expect(classTotal).toBe(body.total);
  });

  it('refuses a breakdown on a share, weights short of 100 and other alone', async () => {
    await classify(owner, stockId, {
      lookThrough: { region: [{ key: 'europe', weight: 100 }] },
    }).expect(400);
    await classify(owner, fundId, {
      lookThrough: { region: [{ key: 'europe', weight: 99 }] },
    }).expect(400);
    // `other` alone names nothing the editor could show.
    await classify(owner, fundId, {
      lookThrough: { region: [{ key: 'other', weight: 100 }] },
    }).expect(400);
    // Neither refusal changed what was stored.
    const fund = await classify(owner, fundId, {}).expect(200);
    expect(fund.body.lookThrough).toEqual(FUND_BREAKDOWN);
  });

  it('clears a single value with null and leaves what the body does not name', async () => {
    const stock = await classify(owner, stockId, { country: null }).expect(200);
    expect(stock.body).toMatchObject({
      sector: 'information_technology',
      region: 'north_america',
      country: null,
    });
    expect(amountOf((await allocation(owner)).countries, 'unclassified')).toBe(2000 + 99.99);
  });

  it('drops the breakdown when the fund is turned into another class', async () => {
    const changed = await as(owner, request(server()).patch(`/investments/holdings/${fundId}`))
      .send({ assetClass: 'stock' })
      .expect(200);
    expect(changed.body.lookThrough).toBeNull();
    // Back to a fund, it does not come back: it was dropped, not hidden.
    const back = await as(owner, request(server()).patch(`/investments/holdings/${fundId}`))
      .send({ assetClass: 'etf' })
      .expect(200);
    expect(back.body.lookThrough).toBeNull();
    const body = await allocation(owner);
    expect(amountOf(body.regions, 'other')).toBeUndefined();
    expect(amountOf(body.regions, 'unclassified')).toBe(2000 + 1000);
  });

  it('keeps another workspace out', async () => {
    await classify(other, fundId, { sector: 'energy' }).expect(404);
    await as(other, request(server()).get(`/investments/holdings/${fundId}/sector-suggestion`)).expect(
      404,
    );
    const theirs = await allocation(other);
    expect(theirs).toMatchObject({ total: 0, classes: [], sectors: [], regions: [], countries: [] });
    const mine = await classify(owner, fundId, {}).expect(200);
    expect(mine.body.sector).toBeNull();
  });
});
