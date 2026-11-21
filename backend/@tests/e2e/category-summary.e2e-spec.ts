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
 * The category page: twelve months of a category and its subcategories,
 * counted exactly as the reports count it, so the two never disagree.
 */
describe('Category summary (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const stamp = Date.now();
  const emails = {
    owner: `cat-sum-owner-${stamp}@example.com`,
    partner: `cat-sum-partner-${stamp}@example.com`,
    other: `cat-sum-other-${stamp}@example.com`,
  };
  let owner: E2eAccount;
  let partner: E2eAccount;
  let other: E2eAccount;
  let partnerMemberId: string;
  const ids: Record<string, string> = {};
  // A currency with a hand-entered rate, and one with none.
  const RATED = 'ZZQ';
  const UNRATED = 'ZZM';

  const as = (account: E2eAccount, req: request.Test, workspaceId = account.workspaceId) =>
    req.set('Authorization', `Bearer ${account.token}`).set('x-workspace-id', workspaceId);
  const server = () => app.getHttpServer();

  // Months as the server counts them (UTC), `back` months before this one.
  const now = new Date();
  const monthOf = (back: number) =>
    new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - back, 1)).toISOString().slice(0, 7);
  const lastDay = (month: string) => {
    const [year, index] = month.split('-').map(Number);
    return new Date(Date.UTC(year, index, 0)).toISOString().slice(0, 10);
  };
  const lastMonth = monthOf(1);
  const thisMonth = monthOf(0);

  async function book(
    categoryId: string,
    amount: number,
    date: string,
    merchant: string,
    currency = 'USD',
  ): Promise<{ id: string; statementId: string }> {
    const statement = await as(owner, request(server()).post('/statements/manual-expense'))
      .field('amount', String(amount))
      .field('currency', currency)
      .field('merchant', merchant)
      .field('categoryId', categoryId)
      .field('date', date)
      .expect(201);
    const listed = await as(
      owner,
      request(server()).get(`/transactions?statementId=${statement.body.id}`),
    ).expect(200);
    return { id: listed.body.data[0].id, statementId: statement.body.id };
  }

  async function bookIncome(categoryId: string, amount: number, date: string): Promise<void> {
    await dataSource.query(
      `INSERT INTO transactions
         (transaction_date, counterparty_name, payment_purpose, transaction_type, workspace_id,
          amount, credit, currency, category_id, is_verified)
       VALUES ($1, 'Example Employer', 'Salary', 'income', $2, $3, $3, 'USD', $4, true)`,
      [date, owner.workspaceId, amount, categoryId],
    );
  }

  /** An income row in a spending category, with the payee its spending row got. */
  async function refund(categoryId: string, amount: number, date: string, merchant: string) {
    const [{ payee_id: payeeId }] = await dataSource.query(
      `SELECT payee_id FROM transactions
        WHERE workspace_id = $1 AND counterparty_name = $2 AND payee_id IS NOT NULL LIMIT 1`,
      [owner.workspaceId, merchant],
    );
    await dataSource.query(
      `INSERT INTO transactions
         (transaction_date, counterparty_name, payment_purpose, transaction_type, workspace_id,
          amount, credit, currency, category_id, payee_id, is_verified)
       VALUES ($1, $2, 'Refund', 'income', $3, $4, $4, 'USD', $5, $6, true)`,
      [date, merchant, owner.workspaceId, amount, categoryId, payeeId],
    );
  }

  async function category(name: string, type: string, parentId?: string): Promise<string> {
    const res = await as(owner, request(server()).post('/categories'))
      .send({ name: `${name} ${stamp}`, type, ...(parentId ? { parentId } : {}) })
      .expect(201);
    return res.body.id;
  }

  const summary = async (categoryId: string, account = owner, query = '') =>
    (
      await as(
        account,
        request(server()).get(`/categories/${categoryId}/summary${query}`),
        owner.workspaceId,
      ).expect(200)
    ).body;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await e2eTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    dataSource = moduleFixture.get<DataSource>(DataSource);

    owner = await registerAccount(app, emails.owner, 'Member One');
    partner = await registerAccount(app, emails.partner, 'Member Two');
    other = await registerAccount(app, emails.other, 'Member Three');
    await as(owner, request(server()).patch(`/workspaces/${owner.workspaceId}`))
      .send({ currency: 'USD' })
      .expect(200);
    const invite = await as(
      owner,
      request(server()).post(`/workspaces/${owner.workspaceId}/invitations`),
    )
      .send({ email: partner.email, role: 'member', permissions: { canEditStatements: true } })
      .expect(201);
    await request(server())
      .post(`/workspaces/invitations/${invite.body.invitation.token}/accept`)
      .set('Authorization', `Bearer ${partner.token}`)
      .expect(200);
    [{ id: partnerMemberId }] = await dataSource.query(
      'SELECT id FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
      [owner.workspaceId, partner.userId],
    );
    await as(owner, request(server()).post('/exchange-rates/manual'))
      .send({ from: RATED, to: 'USD', rate: 0.5, date: `${monthOf(4)}-01` })
      .expect(201);

    ids.food = await category('Food', 'expense');
    ids.groceries = await category('Groceries', 'expense', ids.food);
    ids.organic = await category('Organic', 'expense', ids.groceries);
    ids.salary = await category('Salary', 'income');
    ids.empty = await category('Quiet', 'expense');

    // Counted.
    await book(ids.groceries, 40, `${lastMonth}-10`, 'ACME Store');
    await book(ids.organic, 6, `${lastMonth}-11`, 'ACME Store');
    await book(ids.food, 10, `${lastMonth}-12`, 'Example Bakery');
    await book(ids.food, 20, `${lastMonth}-13`, 'Example Bakery', RATED);
    await book(ids.groceries, 30, `${monthOf(3)}-05`, 'ACME Store');
    await book(ids.food, 5, `${thisMonth}-01`, 'Example Bakery');
    // Another member's private row: its money counts, its payee is not named.
    const secret = await book(ids.food, 50, `${lastMonth}-14`, 'Example Jeweller');
    await dataSource.query(
      'UPDATE transactions SET is_private = true, owner_member_id = $2 WHERE id = $1',
      [secret.id, partnerMemberId],
    );
    // Left out, as the reports leave them out.
    const excluded = {
      duplicate: await book(ids.food, 100, `${lastMonth}-15`, 'Left Out'),
      transfer: await book(ids.food, 200, `${lastMonth}-15`, 'Left Out'),
      unconfirmed: await book(ids.food, 400, `${lastMonth}-15`, 'Left Out'),
      trashed: await book(ids.food, 800, `${lastMonth}-15`, 'Left Out'),
      processing: await book(ids.food, 1600, `${lastMonth}-15`, 'Left Out'),
    };
    await dataSource.query('UPDATE transactions SET is_duplicate = true WHERE id = $1', [
      excluded.duplicate.id,
    ]);
    await dataSource.query(
      'UPDATE transactions SET transfer_pair_id = gen_random_uuid() WHERE id = $1',
      [excluded.transfer.id],
    );
    await dataSource.query('UPDATE transactions SET is_verified = false WHERE id = $1', [
      excluded.unconfirmed.id,
    ]);
    await dataSource.query('UPDATE statements SET deleted_at = now() WHERE id = $1', [
      excluded.trashed.statementId,
    ]);
    await dataSource.query("UPDATE statements SET status = 'processing' WHERE id = $1", [
      excluded.processing.statementId,
    ]);
    // A currency without a rate is named, never counted 1:1.
    await book(ids.food, 3000, `${lastMonth}-16`, 'Left Out', UNRATED);
    // Money coming back into a spending category is income, as in the reports,
    // unless refunds are netted; from a payee that has spending here too.
    await refund(ids.food, 7, `${lastMonth}-17`, 'ACME Store');
    await bookIncome(ids.salary, 1000, `${lastMonth}-25`);
    await bookIncome(ids.salary, 1000, `${monthOf(2)}-25`);
    // Spending filed in an income category: the reports show it under spending.
    // (The app's own form refuses this; an import or a rule can still file it so.)
    await dataSource.query(
      `INSERT INTO transactions
         (transaction_date, counterparty_name, payment_purpose, transaction_type, workspace_id,
          amount, debit, currency, category_id, is_verified)
       VALUES ($1, 'Example Bank', 'Fee', 'expense', $2, 50, 50, 'USD', $3, true)`,
      [`${lastMonth}-26`, owner.workspaceId, ids.salary],
    );
    // The plain case for the Reports switch: 100 spent, 30 back.
    ids.clothes = await category('Clothes', 'expense');
    await book(ids.clothes, 100, `${lastMonth}-05`, 'Example Outfitters');
    await refund(ids.clothes, 30, `${lastMonth}-08`, 'Example Outfitters');
  });

  afterAll(async () => {
    if (dataSource && owner) {
      await dataSource.query('DELETE FROM transactions WHERE workspace_id = $1', [
        owner.workspaceId,
      ]);
      for (const email of Object.values(emails)) {
        await deleteUserByEmail(dataSource, email);
      }
    }
    await app.close();
  });

  it('counts the category with its subcategories, and only what the reports count', async () => {
    const body = await summary(ids.food);

    expect(body.currency).toBe('USD');
    expect(body.direction).toBe('expense');
    expect(body.months).toHaveLength(12);
    expect(body.months.at(-1)).toEqual({ month: thisMonth, amount: 5 });
    // 40 + 6 + 10 + 20 ZZQ at 0.5 + 50 private.
    expect(body.months.at(-2)).toEqual({ month: lastMonth, amount: 116 });
    expect(body.thisMonth).toBe(5);
    expect(body.lastYearTotal).toBe(151);
    expect(body.missingRates).toEqual([UNRATED]);
    // The refund is income, not spending: named apart, kept out of the figures.
    expect(body.otherDirection).toEqual({ amount: 7 });
  });

  it('averages the full months that had rows, not the empty ones', async () => {
    const body = await summary(ids.food);
    // Last month and three months ago; the months between them are a gap, not zero.
    expect(body.averagePerMonth).toBe((116 + 30) / 2);
  });

  it('breaks a parent down by subcategory, a deeper one inside its branch', async () => {
    const body = await summary(ids.food);
    expect(body.subcategories).toEqual([
      { id: ids.food, name: `Food ${stamp}`, amount: 75 },
      { id: ids.groceries, name: `Groceries ${stamp}`, amount: 76 },
    ].sort((a, b) => b.amount - a.amount));

    const groceries = await summary(ids.groceries);
    expect(groceries.lastYearTotal).toBe(76);
    expect(groceries.subcategories).toEqual([
      { id: ids.groceries, name: `Groceries ${stamp}`, amount: 70 },
      { id: ids.organic, name: `Organic ${stamp}`, amount: 6 },
    ]);
  });

  it('names the top payees, but not from another member’s private row', async () => {
    const mine = await summary(ids.food);
    expect(mine.topPayees.map((payee: { name: string }) => payee.name)).toEqual([
      'ACME Store',
      'Example Bakery',
    ]);
    expect(mine.topPayees[0]).toMatchObject({ amount: 76, count: 3 });

    const theirs = await summary(ids.food, partner);
    expect(theirs.lastYearTotal).toBe(mine.lastYearTotal);
    expect(theirs.topPayees.map((payee: { name: string }) => payee.name)).toContain(
      'Example Jeweller',
    );
  });

  it('agrees with the reports for the same month and data, refunds netted or not', async () => {
    for (const net of [false, true]) {
      for (const month of [lastMonth, monthOf(3)]) {
        const report = await as(
          owner,
          request(server()).get(
            `/reports/cash-flow-map?dateFrom=${month}-01&dateTo=${lastDay(month)}${net ? '&netRefunds=true' : ''}`,
          ),
        ).expect(200);
        for (const id of [ids.food, ids.clothes]) {
          const row = report.body.expense.categories.find((item: { id: string }) => item.id === id);
          const body = await summary(id, owner, net ? '?netRefunds=true' : '');
          expect(
            body.months.find((entry: { month: string }) => entry.month === month).amount,
          ).toBe(row?.amount ?? 0);
        }
      }
    }
  });

  it('nets a refund only when the Reports switch asks, and names it apart otherwise', async () => {
    const plain = await summary(ids.clothes);
    expect(plain.lastYearTotal).toBe(100);
    expect(plain.otherDirection).toEqual({ amount: 30 });
    expect(plain.topPayees).toEqual([
      expect.objectContaining({ name: 'Example Outfitters', amount: 100, count: 1 }),
    ]);

    const netted = await summary(ids.clothes, owner, '?netRefunds=true');
    expect(netted.lastYearTotal).toBe(70);
    expect(netted.otherDirection).toBeNull();
    expect(netted.topPayees).toEqual([
      expect.objectContaining({ name: 'Example Outfitters', amount: 70, count: 2 }),
    ]);

    const food = await summary(ids.food, owner, '?netRefunds=true');
    expect(food.lastYearTotal).toBe(151 - 7);
  });

  it('shows an income category its income', async () => {
    const body = await summary(ids.salary);
    expect(body.direction).toBe('income');
    expect(body.lastYearTotal).toBe(2000);
    expect(body.months.at(-2)).toEqual({ month: lastMonth, amount: 1000 });
    expect(body.subcategories).toEqual([]);
    // The spending filed here is named, not added to the income.
    expect(body.otherDirection).toEqual({ amount: 50 });
    expect(body.topPayees.map((payee: { name: string }) => payee.name)).not.toContain(
      'Example Bank',
    );
  });

  it('gives a category without rows zeros and no average', async () => {
    const body = await summary(ids.empty);
    expect(body.months.every((entry: { amount: number }) => entry.amount === 0)).toBe(true);
    expect(body).toMatchObject({
      thisMonth: 0,
      lastYearTotal: 0,
      averagePerMonth: null,
      subcategories: [],
      topPayees: [],
      otherDirection: null,
    });
  });

  it('answers 404 for another workspace’s category', async () => {
    await as(other, request(server()).get(`/categories/${ids.food}/summary`)).expect(404);
  });

  it('lists the rows of a month with subcategories when asked, in the caller’s workspace only', async () => {
    const list = (query: string, account = owner) =>
      as(account, request(server()).get(`/transactions?${query}`)).expect(200);
    const month = `date_from=${lastMonth}-01&date_to=${lastDay(lastMonth)}`;

    const wide = await list(`categoryId=${ids.food}&subcategories=1&${month}&limit=100`);
    const categories = new Set(
      wide.body.data.map((row: { categoryId: string }) => row.categoryId),
    );
    expect(categories).toEqual(new Set([ids.food, ids.groceries, ids.organic]));

    const narrow = await list(`categoryId=${ids.food}&${month}&limit=100`);
    expect(
      narrow.body.data.every((row: { categoryId: string }) => row.categoryId === ids.food),
    ).toBe(true);

    const foreign = await list(`categoryId=${ids.food}&subcategories=1`, other);
    expect(foreign.body.total).toBe(0);
  });

  it('does not walk into another workspace’s category tree, even a broken one', async () => {
    // A tree no request can build: one of the owner's categories under another workspace's.
    const theirs = await as(other, request(server()).get('/categories?type=expense')).expect(200);
    const stray = await category('Stray', 'expense');
    await book(stray, 9, `${thisMonth}-01`, 'ACME Store');
    await dataSource.query('UPDATE categories SET parent_id = $2 WHERE id = $1', [
      stray,
      theirs.body[0].id,
    ]);

    const res = await as(
      owner,
      request(server()).get(`/transactions?categoryId=${theirs.body[0].id}&subcategories=1`),
    ).expect(200);
    expect(res.body.total).toBe(0);
  });
});
