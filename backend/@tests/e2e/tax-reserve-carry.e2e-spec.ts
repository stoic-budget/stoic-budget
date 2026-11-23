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

/** Last year's tax paid this January settles last year, not this year's reserve. */
describe('Tax reserve carries last year (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const stamp = Date.now();
  const email = `reserve-carry-${stamp}@example.com`;
  let owner: E2eAccount;
  const year = new Date().getFullYear();

  const as = (req: request.Test) =>
    req.set('Authorization', `Bearer ${owner.token}`).set('x-workspace-id', owner.workspaceId);
  const server = () => app.getHttpServer();
  let expenseCategory: string;
  /** Books an expense, or income: a booked row turned into income in its income category. */
  const book = async (categoryId: string, amount: number, date: string, income: boolean) => {
    const created = await as(request(server()).post('/statements/manual-expense'))
      .field('amount', String(amount))
      .field('currency', 'EUR')
      .field('merchant', income ? 'ACME Store - Client' : 'Tax office')
      .field('categoryId', income ? expenseCategory : categoryId)
      .field('date', date)
      .expect(201);
    if (income) {
      const [row] = await dataSource.query('SELECT id FROM transactions WHERE statement_id = $1', [created.body.id]);
      await as(request(server()).put(`/transactions/${row.id}`))
        .send({ debit: 0, credit: amount, categoryId })
        .expect(200);
    }
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await e2eTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    dataSource = moduleFixture.get<DataSource>(DataSource);
    owner = await registerAccount(app, email, 'Reserve Owner');
    await as(request(server()).patch(`/workspaces/${owner.workspaceId}`)).send({ currency: 'EUR' }).expect(200);
    await as(request(server()).put('/tax/settings/vat-status')).send({ status: 'not_registered' }).expect(200);
  });

  afterAll(async () => {
    if (dataSource) {
      await deleteUserByEmail(dataSource, email);
    }
    await app.close();
  });

  it("holds this year's share though January paid last year's tax", async () => {
    const work = await as(request(server()).post('/categories'))
      .send({ name: `Consulting ${stamp}`, type: 'income' })
      .expect(201);
    const taxes = await as(request(server()).post('/categories'))
      .send({ name: `Income tax ${stamp}`, type: 'expense' })
      .expect(201);
    expenseCategory = taxes.body.id;
    await as(request(server()).put('/tax/settings/reserve'))
      .send({ percent: 30, paymentsCategoryId: taxes.body.id })
      .expect(200);
    // Last year earned 1,000 (300 owed), paid this January; this year earned 500 (150 owed).
    await book(work.body.id, 1000, `${year - 1}-12-10`, true);
    await book(taxes.body.id, 300, `${year}-01-15`, false);
    await book(work.body.id, 500, `${year}-01-20`, true);

    const reserve = await as(request(server()).get('/tax/settings/reserve/amount')).expect(200);

    expect(reserve.body).toMatchObject({ carriedOver: 300, total: 150 });
  });
});
