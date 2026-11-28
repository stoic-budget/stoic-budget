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
 * A rollover budget whose limit changes keeps its past: each past month counts
 * at the limit it had, so the change shows from now on, not as six months of
 * difference carried at once.
 */
describe('Budget limit history (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const stamp = Date.now();
  const email = `budget-history-${stamp}@example.com`;
  let owner: E2eAccount;

  const as = (req: request.Test) =>
    req.set('Authorization', `Bearer ${owner.token}`).set('x-workspace-id', owner.workspaceId);
  const server = () => app.getHttpServer();
  const pad = (value: number) => String(value).padStart(2, '0');
  /** The 10th of the month `back` months ago, local time. */
  const tenthOf = (back: number) => {
    const day = new Date();
    day.setDate(1);
    day.setMonth(day.getMonth() - back);
    return `${day.getFullYear()}-${pad(day.getMonth() + 1)}-10`;
  };
  const firstOf = (back: number) => `${tenthOf(back).slice(0, 8)}01`;

  /** A budget started 6 months ago, with each of those months spent exactly at `limit`. */
  async function spentToLimit(name: string, limit: number, mode: 'carry' | 'refill'): Promise<string> {
    const category = await as(request(server()).post('/categories'))
      .send({ name: `${name} ${stamp}`, type: 'expense' })
      .expect(201);
    for (let back = 6; back >= 1; back--) {
      await as(request(server()).post('/statements/manual-expense'))
        .field('amount', String(limit))
        .field('currency', 'USD')
        .field('merchant', `ACME ${name}`)
        .field('categoryId', category.body.id)
        .field('date', tenthOf(back))
        .expect(201);
    }
    const budget = await as(request(server()).post('/budgets'))
      .send({
        name,
        categoryId: category.body.id,
        limitAmount: limit,
        periodType: 'monthly',
        currency: 'USD',
        rolloverMode: mode,
        startsOn: firstOf(6),
      })
      .expect(201);
    const before = await as(request(server()).get(`/budgets/${budget.body.id}`)).expect(200);
    expect(before.body.availableAmount).toBe(limit);
    return budget.body.id as string;
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await e2eTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    dataSource = moduleFixture.get<DataSource>(DataSource);
    owner = await registerAccount(app, email, 'Budget History Owner');
  });

  afterAll(async () => {
    if (dataSource) {
      await deleteUserByEmail(dataSource, email);
    }
    await app.close();
  });

  it('has 200 available after the limit is raised from 100, not 800', async () => {
    const id = await spentToLimit('Renovation', 100, 'carry');

    await as(request(server()).put(`/budgets/${id}`)).send({ limitAmount: 200 }).expect(200);

    const after = await as(request(server()).get(`/budgets/${id}`)).expect(200);
    expect(after.body).toMatchObject({ availableAmount: 200, carriedAmount: 0 });
  });

  it('has 100 available after the limit is cut from 200, not -500', async () => {
    const id = await spentToLimit('Garden', 200, 'refill');

    await as(request(server()).put(`/budgets/${id}`)).send({ limitAmount: 100 }).expect(200);

    const after = await as(request(server()).get(`/budgets/${id}`)).expect(200);
    expect(after.body).toMatchObject({ availableAmount: 100, carriedAmount: 0 });
  });

  it('keeps counting the history after an edit that leaves the limit alone', async () => {
    const id = await spentToLimit('Workshop', 100, 'carry');
    await as(request(server()).put(`/budgets/${id}`)).send({ limitAmount: 150 }).expect(200);

    await as(request(server()).put(`/budgets/${id}`)).send({ name: 'Workshop tools' }).expect(200);

    const after = await as(request(server()).get(`/budgets/${id}`)).expect(200);
    expect(after.body.availableAmount).toBe(150);
  });

  it('counts the past at the new limit when the currency changes with it, not old amounts in a new currency', async () => {
    const id = await spentToLimit('Travel', 100, 'carry');
    await as(request(server()).put(`/budgets/${id}`)).send({ limitAmount: 150 }).expect(200);

    await as(request(server()).put(`/budgets/${id}`))
      .send({ limitAmount: 15000, currency: 'JPY' })
      .expect(200);

    const after = await as(request(server()).get(`/budgets/${id}`)).expect(200);
    // As before the history existed: no figure built from 100 JPY a month.
    expect(after.body.availableAmount).toBeGreaterThan(0);
    const [stored] = await dataSource.query('SELECT limit_history FROM budgets WHERE id = $1', [id]);
    expect(stored.limit_history).toEqual([]);
  });

  it('shows a past month at the limit it had, after a raise today', async () => {
    const id = await spentToLimit('Studio', 100, 'carry');
    await as(request(server()).put(`/budgets/${id}`)).send({ limitAmount: 200 }).expect(200);

    const list = await as(request(server()).get(`/budgets?date=${tenthOf(1)}`)).expect(200);
    const lastMonth = (list.body as Array<{ id: string; availableAmount: number }>).find(b => b.id === id);
    expect(lastMonth?.availableAmount).toBe(100);
  });
});
