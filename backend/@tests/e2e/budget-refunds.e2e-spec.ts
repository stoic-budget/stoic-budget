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

/** A refund booked to an expense category takes its amount off the budget's spending. */
describe('Budget refunds (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const stamp = Date.now();
  const email = `budget-refunds-${stamp}@example.com`;
  let owner: E2eAccount;

  const as = (req: request.Test) =>
    req.set('Authorization', `Bearer ${owner.token}`).set('x-workspace-id', owner.workspaceId);
  const server = () => app.getHttpServer();
  const today = () => new Date().toISOString().slice(0, 10);

  /** Books an expense, or a refund: the same row turned into income, as a returned purchase is. */
  async function book(categoryId: string, amount: number, merchant: string, refund = false): Promise<void> {
    const created = await as(request(server()).post('/statements/manual-expense'))
      .field('amount', String(amount))
      .field('currency', 'USD')
      .field('merchant', merchant)
      .field('categoryId', categoryId)
      .field('date', today())
      .expect(201);
    if (refund) {
      const [row] = await dataSource.query('SELECT id FROM transactions WHERE statement_id = $1', [created.body.id]);
      await as(request(server()).put(`/transactions/${row.id}`))
        .send({ debit: 0, credit: amount, categoryId })
        .expect(200);
    }
  }

  async function budgetFor(name: string): Promise<{ categoryId: string; id: string }> {
    const category = await as(request(server()).post('/categories'))
      .send({ name: `${name} ${stamp}`, type: 'expense' })
      .expect(201);
    const budget = await as(request(server()).post('/budgets'))
      .send({ name, categoryId: category.body.id, limitAmount: 200, periodType: 'monthly', currency: 'USD' })
      .expect(201);
    return { categoryId: category.body.id, id: budget.body.id };
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await e2eTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    dataSource = moduleFixture.get<DataSource>(DataSource);
    owner = await registerAccount(app, email, 'Budget Refunds Owner');
  });

  afterAll(async () => {
    if (dataSource) {
      await deleteUserByEmail(dataSource, email);
    }
    await app.close();
  });

  it('counts a returned purchase off the spending', async () => {
    const { categoryId, id } = await budgetFor('Clothes');
    await book(categoryId, 100, 'ACME Store - Jacket');
    await book(categoryId, 30, 'ACME Store - Return', true);

    const res = await as(request(server()).get(`/budgets/${id}`)).expect(200);

    expect(Number(res.body.spentAmount)).toBe(70);
  });

  it('never goes below nothing spent when refunds outweigh the period', async () => {
    const { categoryId, id } = await budgetFor('Electronics');
    await book(categoryId, 50, 'ACME Store - Charger');
    await book(categoryId, 120, 'ACME Store - Laptop return', true);

    const res = await as(request(server()).get(`/budgets/${id}`)).expect(200);

    expect(Number(res.body.spentAmount)).toBe(0);
  });
});
