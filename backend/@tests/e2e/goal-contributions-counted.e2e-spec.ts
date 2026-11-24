import { EventEmitter2 } from '@nestjs/event-emitter';
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

/** A goal counts a contribution made of a row only while the row itself counts. */
describe('Goal contributions follow their rows (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const email = `goal-counted-${Date.now()}@example.com`;
  let owner: E2eAccount;

  const as = (req: request.Test) =>
    req.set('Authorization', `Bearer ${owner.token}`).set('x-workspace-id', owner.workspaceId);
  const server = () => app.getHttpServer();

  beforeAll(async () => {
    const moduleFixture: TestingModule = await e2eTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    dataSource = moduleFixture.get<DataSource>(DataSource);
    owner = await registerAccount(app, email, 'Goal Owner');
  });

  afterAll(async () => {
    if (dataSource) {
      await deleteUserByEmail(dataSource, email);
    }
    await app.close();
  });

  it('stops counting a contribution once its statement goes to the trash, and counts it again on restore', async () => {
    const goal = await as(request(server()).post('/goals'))
      .send({ name: 'New bike', targetAmount: 1000, currency: 'USD' })
      .expect(201);
    const categories = await as(request(server()).get('/categories?type=expense')).expect(200);
    const category = (categories.body as Array<{ id: string; parentId: string | null }>).find(item => !item.parentId);
    const created = await as(request(server()).post('/statements/manual-expense'))
      .field('categoryId', category?.id ?? '')
      .field('amount', '250')
      .field('currency', 'USD')
      .field('merchant', 'ACME Store - Bike fund')
      .field('date', new Date().toISOString().slice(0, 10))
      .expect(201);
    const [row] = await dataSource.query('SELECT id FROM transactions WHERE statement_id = $1', [created.body.id]);
    await as(request(server()).put(`/transactions/${row.id}/goal`)).send({ goalId: goal.body.id }).expect(200);
    const saved = async () => (await as(request(server()).get(`/goals/${goal.body.id}`)).expect(200)).body.currentAmount;
    // A purchase linked to the goal is money taken from it.
    const linked = await saved();
    expect(Math.abs(linked)).toBe(250);

    await as(request(server()).post(`/statements/${created.body.id}/trash`)).expect(200);
    expect(await saved()).toBe(0);
    // The goal page lists what it counts: the trashed row's movement is gone too.
    const detail = await as(request(server()).get(`/goals/${goal.body.id}`)).expect(200);
    expect(detail.body.contributions).toEqual([]);

    await as(request(server()).post(`/statements/${created.body.id}/restore`)).expect(201);
    expect(await saved()).toBe(linked);
  });

  it('moves the goal at once for a row still waiting in Review', async () => {
    const goal = await as(request(server()).post('/goals'))
      .send({ name: 'Camera', targetAmount: 500, currency: 'USD' })
      .expect(201);
    const categories = await as(request(server()).get('/categories?type=expense')).expect(200);
    const category = (categories.body as Array<{ id: string; parentId: string | null }>).find(item => !item.parentId);
    const created = await as(request(server()).post('/statements/manual-expense'))
      .field('categoryId', category?.id ?? '')
      .field('amount', '80')
      .field('currency', 'USD')
      .field('merchant', 'ACME Store - Lens')
      .field('date', new Date().toISOString().slice(0, 10))
      .expect(201);
    const [row] = await dataSource.query('SELECT id FROM transactions WHERE statement_id = $1', [created.body.id]);
    await dataSource.query('UPDATE transactions SET is_verified = false WHERE id = $1', [row.id]);

    await as(request(server()).put(`/transactions/${row.id}/goal`)).send({ goalId: goal.body.id }).expect(200);

    const detail = await as(request(server()).get(`/goals/${goal.body.id}`)).expect(200);
    expect(Math.abs(detail.body.currentAmount)).toBe(80);
  });

  it("follows a linked row's amount when it is edited outside the drawer (#609)", async () => {
    const goal = await as(request(server()).post('/goals'))
      .send({ name: 'Kayak', targetAmount: 900, currency: 'USD' })
      .expect(201);
    const categories = await as(request(server()).get('/categories?type=expense')).expect(200);
    const category = (categories.body as Array<{ id: string; parentId: string | null }>).find(item => !item.parentId);
    const created = await as(request(server()).post('/statements/manual-expense'))
      .field('categoryId', category?.id ?? '')
      .field('amount', '120')
      .field('currency', 'USD')
      .field('merchant', 'ACME Store - Paddle')
      .field('date', new Date().toISOString().slice(0, 10))
      .expect(201);
    const [row] = await dataSource.query('SELECT id FROM transactions WHERE statement_id = $1', [created.body.id]);
    await as(request(server()).put(`/transactions/${row.id}/goal`)).send({ goalId: goal.body.id }).expect(200);
    const saved = async () => Math.abs((await as(request(server()).get(`/goals/${goal.body.id}`)).expect(200)).body.currentAmount);
    expect(await saved()).toBe(120);

    // The statement page and a bulk edit both go through the bulk update.
    await as(request(server()).post('/transactions/bulk-update'))
      .send({ items: [{ id: row.id, updates: { debit: 95 } }] })
      .expect(200);

    // Refreshed once the edit commits.
    let amount = await saved();
    for (let tries = 0; amount !== 95 && tries < 20; tries++) {
      await new Promise(resolve => setTimeout(resolve, 100));
      amount = await saved();
    }
    expect(amount).toBe(95);
    // Still money taken from the goal, as the purchase was.
    const [stored] = await dataSource.query(
      'SELECT amount::float AS amount FROM goal_contributions WHERE transaction_id = $1',
      [row.id],
    );
    expect(stored.amount).toBe(-95);

    // update() reaches no subscriber: a receipt's edit synced to its row says so by event.
    await dataSource.query('UPDATE transactions SET debit = 60, amount = 60 WHERE id = $1', [row.id]);
    app.get(EventEmitter2).emit('transactions.money-changed', { workspaceId: owner.workspaceId, transactionIds: [row.id] });
    let followed = await saved();
    for (let tries = 0; followed !== 60 && tries < 20; tries++) {
      await new Promise(resolve => setTimeout(resolve, 100));
      followed = await saved();
    }
    expect(followed).toBe(60);
  });
});
