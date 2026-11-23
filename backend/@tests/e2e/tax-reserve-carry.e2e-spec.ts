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
 * The reserve is one running balance (#626): what the books owed before this
 * year, less what they paid before it, is still owed, so a January payment of
 * last year's tax does not come off this year's.
 */
describe('Tax reserve carries the years before (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const stamp = Date.now();
  const year = new Date().getFullYear();
  const emails: string[] = [];

  /** A workspace keeping 30 % of earnings, its income and tax-payment categories. */
  const setUp = async (name: string) => {
    const email = `reserve-${name}-${stamp}@example.com`;
    emails.push(email);
    const owner: E2eAccount = await registerAccount(app, email, 'Member One');
    const as = (req: request.Test) =>
      req.set('Authorization', `Bearer ${owner.token}`).set('x-workspace-id', owner.workspaceId);
    const server = app.getHttpServer();
    await as(request(server).patch(`/workspaces/${owner.workspaceId}`))
      .send({ currency: 'EUR' })
      .expect(200);
    await as(request(server).put('/tax/settings/vat-status'))
      .send({ status: 'not_registered' })
      .expect(200);
    const work = await as(request(server).post('/categories'))
      .send({ name: 'Consulting', type: 'income' })
      .expect(201);
    const taxes = await as(request(server).post('/categories'))
      .send({ name: 'Income tax', type: 'expense' })
      .expect(201);
    await as(request(server).put('/tax/settings/reserve'))
      .send({ percent: 30, paymentsCategoryId: taxes.body.id })
      .expect(200);

    /** An expense booked straight away, or income: a booked row turned into income. */
    const book = async (amount: number, date: string, income: boolean) => {
      const created = await as(request(server).post('/statements/manual-expense'))
        .field('amount', String(amount))
        .field('currency', 'EUR')
        .field('merchant', income ? 'ACME Store - Client' : 'Tax office')
        .field('categoryId', taxes.body.id)
        .field('date', date)
        .expect(201);
      if (income) {
        const [row] = await dataSource.query(
          'SELECT id FROM transactions WHERE statement_id = $1',
          [created.body.id],
        );
        await as(request(server).put(`/transactions/${row.id}`))
          .send({ debit: 0, credit: amount, categoryId: work.body.id })
          .expect(200);
      }
    };
    return {
      earn: (amount: number, date: string) => book(amount, date, true),
      pay: (amount: number, date: string) => book(amount, date, false),
      reserve: async () =>
        (await as(request(server).get('/tax/settings/reserve/amount')).expect(200)).body,
    };
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await e2eTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    dataSource = moduleFixture.get<DataSource>(DataSource);
  });

  afterAll(async () => {
    for (const email of emails) {
      await deleteUserByEmail(dataSource, email);
    }
    await app.close();
  });

  it("holds this year's share though January paid last year's tax", async () => {
    const books = await setUp('one');
    await books.earn(1000, `${year - 1}-12-10`); // 300 owed
    await books.pay(300, `${year}-01-15`);
    await books.earn(500, `${year}-01-20`); // 150 owed

    expect(await books.reserve()).toMatchObject({ carriedOver: 300, total: 150 });
  });

  it('keeps the balance running when every January pays the year before', async () => {
    const books = await setUp('running');
    await books.earn(1000, `${year - 2}-12-10`); // 300 owed
    await books.pay(300, `${year - 1}-01-15`); // for two years back
    await books.earn(1000, `${year - 1}-12-10`); // 300 owed
    await books.pay(300, `${year}-01-15`); // for last year
    await books.earn(500, `${year}-01-20`); // 150 owed

    expect(await books.reserve()).toMatchObject({ carriedOver: 300, total: 150 });
  });

  it('carries nothing when last year paid its own tax', async () => {
    const books = await setUp('settled');
    await books.earn(1000, `${year - 1}-03-10`);
    await books.pay(300, `${year - 1}-11-15`);
    await books.earn(500, `${year}-01-20`);

    expect(await books.reserve()).toMatchObject({ carriedOver: 0, total: 150 });
  });

  it('carries no credit when last year paid more than it owed', async () => {
    const books = await setUp('overpaid');
    await books.earn(1000, `${year - 1}-03-10`);
    await books.pay(500, `${year - 1}-11-15`);
    await books.earn(500, `${year}-01-20`);

    expect(await books.reserve()).toMatchObject({ carriedOver: 0, total: 150 });
  });
});
