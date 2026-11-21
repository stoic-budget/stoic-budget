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
  let categoryId: string;

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
  const dashboardBalance = async () =>
    (await as(request(server()).get('/dashboard')).expect(200)).body.snapshot.totalBalance as number;
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
    categoryId = category.body.id;
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
    const dashboardBalanceBefore = await dashboardBalance();

    const updated = await setExcluded(true);

    expect(updated.body.excludedFromBudgets).toBe(true);
    expect(await budgetSpent()).toBe(everyday);
    expect(await monthlyExpense()).toBe(everyday);
    // The car was still paid for: the account and net worth keep the row.
    expect(balanceBefore).toBe(opening - everyday - oneOff);
    expect(await walletBalance()).toBe(balanceBefore);
    expect(await netWorth()).toBe(netWorthBefore);
    // The dashboard's all-time balance (and the forecast's opening one without accounts) too.
    expect(await dashboardBalance()).toBe(dashboardBalanceBefore);
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

  it("tells the row's history who left it out of budgets, and lets that be put back", async () => {
    await setExcluded(true);

    const history = await as(request(server()).get(`/transactions/${oneOffId}/history`)).expect(200);
    const left = history.body.entries.find((entry: { changes: Array<{ field: string }> }) =>
      entry.changes.some(change => change.field === 'budgets'),
    );
    expect(left.changes).toContainEqual(
      expect.objectContaining({ field: 'budgets', before: 'false', after: 'true' }),
    );
    expect(left.canUndo).toBe(true);
    await setExcluded(false);
  });

  it('keeps an uncategorised row left out of budgets in the categorise step: tax still reads it', async () => {
    const uncategorised = await bookExpense(categoryId, 'ACME Garage - Repair', 40);
    await dataSource.query('UPDATE transactions SET category_id = NULL WHERE id = $1', [uncategorised]);
    await as(request(server()).put(`/transactions/${uncategorised}`))
      .send({ excludedFromBudgets: true })
      .expect(200);

    const queue = await as(
      request(server()).get('/review-inbox?kind=transaction&uncategorized=true'),
    ).expect(200);
    expect(queue.body.items.map((item: { id: string }) => item.id)).toContain(uncategorised);
  });

  it('refuses to unsplit parts the budgets count differently, until they agree', async () => {
    const charge = await bookExpense(categoryId, 'ACME Hardware - Tools', 100);
    const parts = await as(request(server()).post(`/transactions/${charge}/split`))
      .send({ parts: [{ amount: 60 }, { amount: 40 }] })
      .expect(200);
    const leftOut = parts.body[1].id as string;
    await as(request(server()).put(`/transactions/${leftOut}`))
      .send({ excludedFromBudgets: true })
      .expect(200);

    const refused = await as(request(server()).post(`/transactions/${charge}/unsplit`)).expect(400);
    expect(refused.body.error?.code ?? refused.body.code).toBe('TRANSACTION_UNSPLIT_MIXED_BUDGETS');

    await as(request(server()).put(`/transactions/${leftOut}`))
      .send({ excludedFromBudgets: false })
      .expect(200);
    await as(request(server()).post(`/transactions/${charge}/unsplit`)).expect(200);
  });
});
