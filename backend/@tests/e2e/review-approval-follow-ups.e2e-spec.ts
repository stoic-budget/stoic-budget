vi.mock('franc', () => ({
  franc: () => 'und',
}));

import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
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

/** Rows confirmed in Review start counting: budgets, subscriptions and bills hear of them. */
describe('Review approval follow-ups (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const stamp = Date.now();
  const email = `review-follow-${stamp}@example.com`;
  let owner: E2eAccount;

  const as = (req: request.Test) =>
    req.set('Authorization', `Bearer ${owner.token}`).set('x-workspace-id', owner.workspaceId);
  const server = () => app.getHttpServer();
  const today = () => new Date().toISOString().slice(0, 10);
  const until = async (check: () => Promise<boolean>) => {
    for (let i = 0; i < 40 && !(await check()); i++) await new Promise(r => setTimeout(r, 50));
  };

  /** A budget of 10 USD on a parent category, and a child category under it. */
  async function budgetWithChild(name: string) {
    const parent = await as(request(server()).post('/categories'))
      .send({ name: `${name} ${stamp}`, type: 'expense' })
      .expect(201);
    const child = await as(request(server()).post('/categories'))
      .send({ name: `${name} child ${stamp}`, type: 'expense', parentId: parent.body.id })
      .expect(201);
    const budget = await as(request(server()).post('/budgets'))
      .send({ name, categoryId: parent.body.id, limitAmount: 10, periodType: 'monthly', currency: 'USD' })
      .expect(201);
    return { childId: child.body.id as string, budgetId: budget.body.id as string };
  }
  const expense = (categoryId: string, merchant: string) =>
    as(request(server()).post('/statements/manual-expense'))
      .field('amount', '25')
      .field('currency', 'USD')
      .field('merchant', merchant)
      .field('categoryId', categoryId)
      .field('date', today())
      .expect(201);
  const alerted = async (budgetId: string) =>
    (await dataSource.query('SELECT alert_at_100_sent FROM budgets WHERE id = $1', [budgetId]))[0]
      .alert_at_100_sent as boolean;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await e2eTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    dataSource = moduleFixture.get<DataSource>(DataSource);
    owner = await registerAccount(app, email, 'Review Owner');
  });

  afterAll(async () => {
    if (dataSource) {
      await deleteUserByEmail(dataSource, email);
    }
    await app.close();
  });

  it('warns the budget up the tree for a spend in a subcategory', async () => {
    const { childId, budgetId } = await budgetWithChild('Hobbies');

    await expense(childId, 'ACME Store - Paints');

    await until(() => alerted(budgetId));
    expect(await alerted(budgetId)).toBe(true);
  });

  it('announces rows approved in Review, and their budget warns then', async () => {
    const { childId, budgetId } = await budgetWithChild('Garden');
    const created = await expense(childId, 'ACME Store - Seeds');
    const [row] = await dataSource.query('SELECT id FROM transactions WHERE statement_id = $1', [created.body.id]);
    // Waiting in Review: it counts nowhere yet, and no alert went out for it.
    await dataSource.query('UPDATE transactions SET is_verified = false WHERE id = $1', [row.id]);
    await dataSource.query('UPDATE budgets SET alert_at_100_sent = false WHERE id = $1', [budgetId]);
    const posted = vi.fn();
    app.get(EventEmitter2).on('transactions.posted', posted);

    await as(request(server()).post('/review-inbox/transactions/approve')).send({ ids: [row.id] }).expect(200);

    expect(posted).toHaveBeenCalledWith(expect.objectContaining({ transactionIds: [row.id] }));
    await until(() => alerted(budgetId));
    expect(await alerted(budgetId)).toBe(true);
  });
});
