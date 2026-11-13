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
 * A row left out of budgets leaves every income and spending figure (a budget's
 * spending, a report's total) and keeps counting where the money itself is
 * counted: its account's balance and net worth.
 */
describe('Exclude a transaction from budgets (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const stamp = Date.now();
  const email = `exclude-budgets-${stamp}@example.com`;
  let owner: E2eAccount;
  let budgetId: string;
  let walletId: string;
  let oneOffId: string;

  const opening = 500;
  const everyday = 30;
  const oneOff = 200;

  const as = (req: request.Test) =>
    req.set('Authorization', `Bearer ${owner.token}`).set('x-workspace-id', owner.workspaceId);
  const server = () => app.getHttpServer();
  const today = new Date().toISOString().slice(0, 10);
  const [year, month] = today.split('-').map(Number);

  async function bookExpense(categoryId: string, merchant: string, amount: number) {
    const booked = await as(request(server()).post('/statements/manual-expense'))
      .field('amount', String(amount))
      .field('currency', 'USD')
      .field('merchant', merchant)
      .field('categoryId', categoryId)
      .field('date', today)
      .field('walletId', walletId)
      .expect(201);
    const rows = await as(
      request(server()).get(`/transactions?statementId=${booked.body.id}`),
    ).expect(200);
    return rows.body.data[0].id as string;
  }

  const budgetSpent = async () =>
    Number((await as(request(server()).get(`/budgets/${budgetId}`)).expect(200)).body.spentAmount);
  const monthlyExpense = async () =>
    (await as(request(server()).get(`/reports/monthly?year=${year}&month=${month}`)).expect(200))
      .body.comparison.currentPeriod.expense as number;
  const walletBalance = async () =>
    (await as(request(server()).get(`/wallets/${walletId}`)).expect(200)).body.balance as number;
  const netWorth = async () =>
    (await as(request(server()).get('/reports/net-worth?range=30d')).expect(200)).body
      .current as number;
  const setExcluded = (excludedFromBudgets: boolean) =>
    as(request(server()).put(`/transactions/${oneOffId}`))
      .send({ excludedFromBudgets })
      .expect(200);

  beforeAll(async () => {
    const moduleFixture: TestingModule = await e2eTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    dataSource = moduleFixture.get<DataSource>(DataSource);

    owner = await registerAccount(app, email, 'Exclude Budgets Owner');
    // Every figure in one currency, so no exchange rate is involved.
    await as(request(server()).patch(`/workspaces/${owner.workspaceId}`))
      .send({ currency: 'USD' })
      .expect(200);

    const category = await as(request(server()).post('/categories'))
      .send({ name: `Household ${stamp}`, type: 'expense' })
      .expect(201);
    const budget = await as(request(server()).post('/budgets'))
      .send({
        name: 'Household',
        categoryId: category.body.id,
        limitAmount: 1000,
        periodType: 'monthly',
        currency: 'USD',
      })
      .expect(201);
    budgetId = budget.body.id;
    const wallet = await as(request(server()).post('/wallets'))
      .send({ name: 'Everyday account', currency: 'USD', initialBalance: opening })
      .expect(201);
    walletId = wallet.body.id;

    await bookExpense(category.body.id, 'ACME Store - Groceries', everyday);
    oneOffId = await bookExpense(category.body.id, 'ACME Motors - Used Car', oneOff);
  });

  afterAll(async () => {
    if (dataSource) {
      await deleteUserByEmail(dataSource, email);
    }
    await app.close();
  });

  it('counts a new row in budgets until the user leaves it out', async () => {
    const listed = await as(request(server()).get(`/transactions/${oneOffId}`)).expect(200);

    expect(listed.body.excludedFromBudgets).toBe(false);
    expect(await budgetSpent()).toBe(everyday + oneOff);
    expect(await monthlyExpense()).toBe(everyday + oneOff);
  });

  it('drops the excluded row from budget spending and the report total, not from the money', async () => {
    const balanceBefore = await walletBalance();
    const netWorthBefore = await netWorth();

    const updated = await setExcluded(true);

    expect(updated.body.excludedFromBudgets).toBe(true);
    expect(await budgetSpent()).toBe(everyday);
    expect(await monthlyExpense()).toBe(everyday);
    // The car was still paid for: the account and net worth keep the row.
    expect(balanceBefore).toBe(opening - everyday - oneOff);
    expect(await walletBalance()).toBe(balanceBefore);
    expect(await netWorth()).toBe(netWorthBefore);
  });

  it('brings the row back through the bulk update', async () => {
    const bulk = await as(request(server()).post('/transactions/bulk-update'))
      .send({ ids: [oneOffId], updates: { excludedFromBudgets: false } })
      .expect(200);

    expect(bulk.body[0].excludedFromBudgets).toBe(false);
    expect(await budgetSpent()).toBe(everyday + oneOff);
  });

  it('refuses a null, since the flag always holds a decision', async () => {
    await as(request(server()).put(`/transactions/${oneOffId}`))
      .send({ excludedFromBudgets: null })
      .expect(400);
  });
});
