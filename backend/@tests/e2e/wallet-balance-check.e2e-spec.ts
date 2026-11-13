vi.mock('franc', () => ({
  franc: () => 'und',
}));

import { type INestApplication, ValidationPipe } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { BankName, FileType, Statement, StatementStatus } from '../../src/entities/statement.entity';
import { Transaction, TransactionType } from '../../src/entities/transaction.entity';
import { WorkspaceMember, WorkspaceRole } from '../../src/entities/workspace-member.entity';
import {
  deleteUserByEmail,
  type E2eAccount,
  e2eTestingModule,
  registerAccount,
} from './helpers/e2e-app';

/**
 * "Check balance" end to end: one number from the bank against ours at the end
 * of a day. A match is remembered, a difference comes with its likely reasons,
 * and booking it adds one row that moves the balance and net worth but never
 * spending, income, budgets or reports, once however often it is clicked.
 */
describe('Account balance check (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const stamp = Date.now();
  const emails = {
    owner: `balance-check-owner-${stamp}@example.com`,
    other: `balance-check-other-${stamp}@example.com`,
    viewer: `balance-check-viewer-${stamp}@example.com`,
  };
  let owner: E2eAccount;
  let other: E2eAccount;
  let viewer: E2eAccount;
  let viewerMemberId: string;
  let currency: string;
  let walletId: string;

  const day = '2026-09-10';
  const opening = 100;
  const as = (account: E2eAccount, req: request.Test, workspaceId = owner.workspaceId) =>
    req.set('Authorization', `Bearer ${account.token}`).set('x-workspace-id', workspaceId);
  const server = () => app.getHttpServer();
  const today = () => new Date().toISOString().slice(0, 10);

  /** A row of the account; spending below zero. */
  async function book(
    date: string,
    amount: number,
    flags: Partial<Transaction> = {},
    wallet = walletId,
  ): Promise<string> {
    const rows = dataSource.getRepository(Transaction);
    const saved = await rows.save(
      rows.create({
        workspaceId: owner.workspaceId,
        walletId: wallet,
        // The day as a string: a Date would be written in the test's own time zone.
        transactionDate: date as unknown as Date,
        counterpartyName: 'ACME Store',
        paymentPurpose: 'Purchase',
        currency,
        transactionType: amount > 0 ? TransactionType.INCOME : TransactionType.EXPENSE,
        amount: Math.abs(amount),
        credit: amount > 0 ? amount : null,
        debit: amount < 0 ? -amount : null,
        isVerified: true,
        ...flags,
      }),
    );
    return saved.id;
  }

  /** A read statement of the account covering `from`–`to`, with no rows of its own. */
  async function cover(from: string, to: string): Promise<void> {
    const statements = dataSource.getRepository(Statement);
    await statements.save(
      statements.create({
        userId: owner.userId,
        workspaceId: owner.workspaceId,
        walletId,
        fileName: `everyday-${from}.csv`,
        filePath: '/dev/null',
        fileType: FileType.CSV,
        fileSize: 1,
        fileHash: `hash-${stamp}-${from}`,
        bankName: BankName.OTHER,
        currency,
        statementDateFrom: from as unknown as Date,
        statementDateTo: to as unknown as Date,
        totalTransactions: 0,
        status: StatementStatus.COMPLETED,
      }),
    );
  }

  const check = (balance: number, date = day, account = owner, id = walletId) =>
    as(account, request(server()).post(`/wallets/${id}/balance-check`)).send({ date, balance });
  const wallet = async (id = walletId) =>
    (await as(owner, request(server()).get(`/wallets/${id}`)).expect(200)).body;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await e2eTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    dataSource = moduleFixture.get<DataSource>(DataSource);

    owner = await registerAccount(app, emails.owner, 'Member One');
    other = await registerAccount(app, emails.other, 'Member Two');
    viewer = await registerAccount(app, emails.viewer, 'Member Three');
    const membership = await dataSource.getRepository(WorkspaceMember).save({
      workspaceId: owner.workspaceId,
      userId: viewer.userId,
      role: WorkspaceRole.VIEWER,
      invitedById: owner.userId,
    });
    viewerMemberId = membership.id;
    currency = (await as(owner, request(server()).get('/wallets/summary')).expect(200)).body
      .currency;

    const created = await as(owner, request(server()).post('/wallets'))
      .send({ name: 'Everyday', type: 'checking', initialBalance: opening })
      .expect(201);
    walletId = created.body.id;
    await book('2026-09-05', 80);
    await book('2026-09-08', -30);
  });

  afterAll(async () => {
    if (dataSource) {
      for (const account of [owner, other, viewer].filter(Boolean)) {
        await dataSource.query('DELETE FROM transactions WHERE workspace_id = $1', [
          account.workspaceId,
        ]);
      }
      for (const email of Object.values(emails)) {
        await deleteUserByEmail(dataSource, email);
      }
    }
    await app.close();
  });

  it('a match is remembered only when confirmed; a mismatch is never saved', async () => {
    const res = await check(150).expect(200);
    expect(res.body).toEqual({
      date: day,
      bankBalance: 150,
      ourBalance: 150,
      difference: 0,
      matches: true,
      reasons: [],
    });
    // Checking alone writes nothing.
    expect((await wallet()).balanceCheck).toBeNull();

    await as(owner, request(server()).post(`/wallets/${walletId}/balance-check/confirm`))
      .send({ date: day, balance: 150 })
      .expect(200);
    expect((await wallet()).balanceCheck).toEqual({
      date: day,
      bankBalance: 150,
      stillMatches: true,
    });

    const refused = await as(
      owner,
      request(server()).post(`/wallets/${walletId}/balance-check/confirm`),
    )
      .send({ date: day, balance: 150.01 })
      .expect(409);
    expect(refused.body.error).toMatchObject({ code: 'BALANCE_CHECK_MISMATCH' });
    expect((await wallet()).balanceCheck.bankBalance).toBe(150);
  });

  it('refuses a day the bank cannot have shown yet', async () => {
    const res = await check(150, '2099-01-01').expect(400);
    expect(res.body.error).toMatchObject({ code: 'BALANCE_CHECK_FUTURE_DATE' });
  });

  it('says where a difference probably is, and saves nothing', async () => {
    await book('2026-09-09', -12, { isVerified: false });
    await book('2026-09-09', -7, { isDuplicate: true });
    // Booked on the 12th here, already gone at the bank on the 10th; another
    // member's private row, so its merchant stays theirs.
    const early = await book('2026-09-12', -25, {
      isPrivate: true,
      ownerMemberId: viewerMemberId,
      counterpartyName: 'Example Pharmacy',
    });
    // A row well outside the window must not join in.
    await book('2026-09-30', -3);
    await cover('2026-07-01', '2026-07-31');
    await cover('2026-09-01', '2026-09-10');
    // An expense typed in by hand is a one-day document: it covers no period.
    await cover('2026-08-15', '2026-08-15');

    const res = await check(125).expect(200);
    expect(res.body).toMatchObject({ ourBalance: 150, difference: -25, matches: false });
    expect(res.body.reasons).toEqual([
      { kind: 'in_review', count: 1, amount: -12 },
      { kind: 'duplicates', count: 1, amount: -7 },
      {
        kind: 'booked_later',
        amount: -25,
        rows: [{ id: early, date: '2026-09-12', payee: '—', amount: -25 }],
      },
      { kind: 'statement_gap', from: '2026-08-01', to: '2026-08-31' },
    ]);

    // Nothing was remembered from a mismatch.
    expect((await wallet()).balanceCheck.bankBalance).toBe(150);
  });

  it('refuses to book while rows of the account wait in Review or as duplicates', async () => {
    // The 'Everyday' account has one row in Review and one possible duplicate before the day.
    const refused = await as(owner, request(server()).post(`/wallets/${walletId}/balance-adjustment`))
      .send({ date: day, balance: 140 })
      .expect(409);
    expect(refused.body.error).toMatchObject({
      code: 'BALANCE_CHECK_PENDING_REVIEW',
      params: { count: 2 },
    });
    const rows = await dataSource.query(
      `SELECT COUNT(*)::int AS n FROM transactions WHERE wallet_id = $1 AND transfer_pair_kind = 'adjustment'`,
      [walletId],
    );
    expect(rows[0].n).toBe(0);
  });

  it('books the difference once however often it is clicked, and remembers the check', async () => {
    const created = await as(owner, request(server()).post('/wallets'))
      .send({ name: 'Double click', type: 'checking', initialBalance: 150 })
      .expect(201);
    const doubleId = created.body.id as string;
    const before = await wallet(doubleId);
    const send = () =>
      as(owner, request(server()).post(`/wallets/${doubleId}/balance-adjustment`)).send({
        date: day,
        balance: 140,
      });
    const [first, second] = await Promise.all([send(), send()]);
    expect([first.status, second.status]).toEqual([200, 200]);
    const ids = [first.body.transactionId, second.body.transactionId].filter(Boolean);
    expect(ids).toHaveLength(1);
    for (const res of [first, second]) {
      expect(res.body.check).toMatchObject({ ourBalance: 140, difference: 0, matches: true });
    }

    const rows: Array<Record<string, unknown>> = await dataSource.query(
      `SELECT id, debit, credit, transaction_date::text AS date, counterparty_name, is_verified,
              transfer_pair_id, transfer_pair_kind, payee_id, category_id
         FROM transactions WHERE wallet_id = $1 AND transfer_pair_kind = 'adjustment'`,
      [doubleId],
    );
    expect(rows).toEqual([
      {
        id: ids[0],
        debit: '10.00',
        credit: null,
        date: day,
        counterparty_name: 'Balance adjustment',
        is_verified: true,
        transfer_pair_id: ids[0],
        transfer_pair_kind: 'adjustment',
        payee_id: null,
        category_id: null,
      },
    ]);
    const after = await wallet(doubleId);
    expect(after.balance).toBe(before.balance - 10);
    expect(after.balanceCheck).toEqual({ date: day, bankBalance: 140, stillMatches: true });

    const [audit] = await dataSource.query(
      `SELECT action, is_undoable FROM audit_events WHERE entity_id = $1`,
      [ids[0]],
    );
    expect(audit).toEqual({ action: 'create', is_undoable: true });

    // Removing the row, like any manual row, undoes the match it made.
    await as(owner, request(server()).delete(`/transactions/${ids[0]}`)).expect(204);
    expect((await wallet(doubleId)).balanceCheck).toEqual({
      date: day,
      bankBalance: 140,
      stillMatches: false,
    });

    // Rolling the delete back brings the row back as it was: still no payee.
    const [deleted] = await dataSource.query(
      `SELECT id FROM audit_events WHERE entity_id = $1 AND action = 'delete'`,
      [ids[0]],
    );
    await dataSource.query(`UPDATE users SET role = 'admin' WHERE id = $1`, [owner.userId]);
    try {
      await as(owner, request(server()).post(`/audit-events/${deleted.id}/rollback`)).expect(201);
    } finally {
      await dataSource.query(`UPDATE users SET role = 'user' WHERE id = $1`, [owner.userId]);
    }
    const [restored] = await dataSource.query(
      'SELECT payee_id, transfer_pair_kind FROM transactions WHERE id = $1',
      [ids[0]],
    );
    expect(restored).toEqual({ payee_id: null, transfer_pair_kind: 'adjustment' });
    expect((await wallet(doubleId)).balanceCheck.stillMatches).toBe(true);
  });

  it('moves the balance and net worth, never spending, income, budgets or reports', async () => {
    const date = today();
    const [year, month] = date.split('-').map(Number);
    const category = await as(owner, request(server()).post('/categories'))
      .send({ name: `Bank fees ${stamp}`, type: 'expense' })
      .expect(201);
    const budget = await as(owner, request(server()).post('/budgets'))
      .send({
        name: 'Fees',
        categoryId: category.body.id,
        limitAmount: 100,
        periodType: 'monthly',
        currency,
      })
      .expect(201);
    const spare = await as(owner, request(server()).post('/wallets'))
      .send({ name: 'Spare', type: 'checking', initialBalance: 50 })
      .expect(201);

    const figures = async () => {
      const [dashboard, monthly, daily, spent, netWorth, account] = await Promise.all([
        as(owner, request(server()).get(`/dashboard?range=month&date=${date}`)).expect(200),
        as(owner, request(server()).get(`/reports/monthly?year=${year}&month=${month}`)).expect(
          200,
        ),
        as(owner, request(server()).get(`/reports/daily?date=${date}`)).expect(200),
        as(owner, request(server()).get(`/budgets/${budget.body.id}`)).expect(200),
        as(owner, request(server()).get('/reports/net-worth?range=30d')).expect(200),
        as(owner, request(server()).get(`/wallets/${spare.body.id}`)).expect(200),
      ]);
      return {
        spending: [
          dashboard.body.snapshot.expense30d,
          dashboard.body.snapshot.income30d,
          monthly.body.comparison.currentPeriod.expense,
          monthly.body.comparison.currentPeriod.income,
          daily.body.expense.totalAmount,
          daily.body.income.totalAmount,
          Number(spent.body.spentAmount),
        ],
        netWorth: netWorth.body.current as number,
        balance: account.body.balance as number,
      };
    };

    const before = await figures();
    const booked = await as(
      owner,
      request(server()).post(`/wallets/${spare.body.id}/balance-adjustment`),
    )
      .send({ date, balance: 20 })
      .expect(200);
    const id = booked.body.transactionId as string;
    // A person cannot file it under the budget's category, nor mark it for tax.
    const refused = await as(owner, request(server()).put(`/transactions/${id}`))
      .send({ categoryId: category.body.id })
      .expect(400);
    expect(refused.body.error).toMatchObject({ code: 'TRANSACTION_ADJUSTMENT_CATEGORY' });
    await as(owner, request(server()).put(`/transactions/${id}`))
      .send({ taxRelevant: true })
      .expect(400);
    // A bulk edit skips it, and a rule or any other raw write is undone by the database.
    await as(owner, request(server()).post('/transactions/bulk-update'))
      .send({ ids: [id], updates: { categoryId: category.body.id } })
      .expect(200);
    await dataSource.query(
      'UPDATE transactions SET category_id = $2, tax_relevant = true WHERE id = $1',
      [id, category.body.id],
    );
    const [row] = await dataSource.query(
      'SELECT category_id, tax_relevant, tax_rate_id FROM transactions WHERE id = $1',
      [id],
    );
    expect(row).toEqual({ category_id: null, tax_relevant: null, tax_rate_id: null });
    const after = await figures();

    expect(after.spending).toEqual(before.spending);
    expect(after.balance).toBe(20);
    expect(after.netWorth).toBeCloseTo(before.netWorth - 30, 2);
  });

  it('keeps the check inside the workspace and away from a viewer', async () => {
    const adjustments = async () =>
      (
        await dataSource.query(
          `SELECT COUNT(*)::int AS n FROM transactions WHERE wallet_id = $1 AND transfer_pair_kind = 'adjustment'`,
          [walletId],
        )
      )[0].n as number;
    const before = await adjustments();
    const checkedBefore = (await wallet()).balanceCheck;
    await check(150, day, other, walletId).set('x-workspace-id', other.workspaceId).expect(404);
    await as(
      other,
      request(server()).post(`/wallets/${walletId}/balance-adjustment`),
      other.workspaceId,
    )
      .send({ date: day, balance: 1 })
      .expect(404);

    for (const path of ['balance-check', 'balance-check/confirm', 'balance-adjustment']) {
      await as(viewer, request(server()).post(`/wallets/${walletId}/${path}`))
        .send({ date: day, balance: 1 })
        .expect(403);
    }
    expect(await adjustments()).toBe(before);
    expect((await wallet()).balanceCheck).toEqual(checkedBefore);
  });

  it('an adjustment cannot be split or unlinked, makes no payee and is no transfer', async () => {
    const spare = await as(owner, request(server()).post('/wallets'))
      .send({ name: 'Drawer', type: 'checking', initialBalance: 40 })
      .expect(201);
    const booked = await as(
      owner,
      request(server()).post(`/wallets/${spare.body.id}/balance-adjustment`),
    )
      .send({ date: day, balance: 25 })
      .expect(200);
    const id = booked.body.transactionId as string;

    const split = await as(owner, request(server()).post(`/transactions/${id}/split`))
      .send({ parts: [{ amount: 10 }, { amount: 5 }] })
      .expect(400);
    expect(split.body.error).toMatchObject({ code: 'TRANSACTION_SPLIT_ADJUSTMENT' });
    const unlink = await as(owner, request(server()).post(`/transactions/${id}/unlink-transfer`))
      .send({})
      .expect(400);
    expect(unlink.body.error).toMatchObject({ code: 'TRANSACTION_UNLINK_ADJUSTMENT' });

    const [row] = await dataSource.query(
      'SELECT transfer_pair_id, split_group_id, payee_id, payee_key FROM transactions WHERE id = $1',
      [id],
    );
    expect(row).toEqual({
      transfer_pair_id: id,
      split_group_id: null,
      payee_id: null,
      payee_key: expect.any(String),
    });
    // Editing it later does not mint a payee either.
    await as(owner, request(server()).put(`/transactions/${id}`))
      .send({ comments: 'Bank fee the statement missed' })
      .expect(200);
    const payees = await dataSource.query(
      `SELECT COUNT(*)::int AS n FROM payees WHERE workspace_id = $1 AND name = 'Balance adjustment'`,
      [owner.workspaceId],
    );
    expect(payees[0].n).toBe(0);

    const transfers = await as(owner, request(server()).get('/transactions?type=transfer')).expect(
      200,
    );
    expect(transfers.body.data.map((tx: { id: string }) => tx.id)).not.toContain(id);
    // Nor is it offered as the payment of a subscription.
    const candidates = await as(
      owner,
      request(server()).get('/subscriptions/charge-candidates?vendorName=Balance%20adjustment'),
    ).expect(200);
    expect(JSON.stringify(candidates.body)).not.toContain(id);
  });

  it('refuses to book while rows without a rate are left out, and names their currency', async () => {
    const abroad = await as(owner, request(server()).post('/wallets'))
      .send({ name: 'Travel', type: 'checking', initialBalance: 100 })
      .expect(201);
    // XTS is the ISO code reserved for testing: no rate exists for it.
    await book('2026-09-04', -30, { currency: 'XTS' }, abroad.body.id);

    const res = await check(70, day, owner, abroad.body.id).expect(200);
    expect(res.body).toMatchObject({ ourBalance: 100, difference: -30, matches: false });
    expect(res.body.reasons).toContainEqual({ kind: 'unconverted', currencies: ['XTS'] });

    const refused = await as(
      owner,
      request(server()).post(`/wallets/${abroad.body.id}/balance-adjustment`),
    )
      .send({ date: day, balance: 70 })
      .expect(409);
    expect(refused.body.error).toMatchObject({
      code: 'BALANCE_CHECK_UNCONVERTED',
      params: { currencies: 'XTS' },
    });
    const rows = await dataSource.query(
      `SELECT COUNT(*)::int AS n FROM transactions WHERE wallet_id = $1 AND transfer_pair_kind = 'adjustment'`,
      [abroad.body.id],
    );
    expect(rows[0].n).toBe(0);
    // Before the row's day the account had nothing unconverted: that day can still be booked.
    const earlier = await check(100, '2026-09-03', owner, abroad.body.id).expect(200);
    expect(earlier.body.matches).toBe(true);
  });

  it('keeps the newest check when an older day is checked afterwards', async () => {
    const kept = await as(owner, request(server()).post('/wallets'))
      .send({ name: 'Savings box', type: 'savings', initialBalance: 60 })
      .expect(201);
    const confirm = (date: string) =>
      as(owner, request(server()).post(`/wallets/${kept.body.id}/balance-check/confirm`))
        .send({ date, balance: 60 })
        .expect(200);
    await confirm('2026-09-20');
    await confirm('2026-09-01');
    expect((await wallet(kept.body.id)).balanceCheck).toEqual({
      date: '2026-09-20',
      bankBalance: 60,
      stillMatches: true,
    });
  });
});
