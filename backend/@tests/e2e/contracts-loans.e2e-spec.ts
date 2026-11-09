vi.mock('franc', () => ({
  franc: () => 'und',
}));

import { type INestApplication, ValidationPipe } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import { Schema } from 'effect';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import {
  LoanPaymentItem,
  LoanPayments,
  LoanSchedule,
  LoanTermsState,
  LoanWhatIf,
  MessageResult,
} from '../../src/contracts';
import { Transaction, TransactionType } from '../../src/entities/transaction.entity';
import {
  deleteUserByEmail,
  type E2eAccount,
  e2eTestingModule,
  registerAccount,
} from './helpers/e2e-app';

type Method = 'get' | 'post' | 'put' | 'delete';

/**
 * The loan terms and schedule of a debt account, checked against their
 * contracts with data in them: the real balance from the account's counted
 * rows beside the plan, the projection from it, and the what-if.
 */
describe('API contracts: loans (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const email = `contracts-loans-${Date.now()}@example.com`;
  let owner: E2eAccount;
  let loanId: string;
  let checkingId: string;

  const principal = 12_000;
  const terms = {
    principal,
    startDate: '2026-01-10',
    termMonths: 360,
    paymentDay: 10,
    method: 'annuity',
    dayCount: '30/360',
    annualRate: 6,
    rateChanges: [{ from: '2027-06-10', annualRate: 4.5 }],
    extraPayments: [{ date: '2027-03-10', amount: 500 }],
    recurringExtra: null,
    extraMode: 'reduce_term',
  };

  const call = (method: Method, url: string, status: number, body?: object) => {
    const req = request(app.getHttpServer())
      [method](url)
      .set('Authorization', `Bearer ${owner.token}`)
      .set('x-workspace-id', owner.workspaceId);
    return (body ? req.send(body) : req).expect(status);
  };
  const matches = (schema: Schema.Top, body: unknown) =>
    Schema.decodeUnknownSync(schema as Schema.Codec<unknown, unknown>)(body);

  const payment = (date: string, amount: number, overrides: Partial<Transaction> = {}) =>
    dataSource.getRepository(Transaction).create({
      workspaceId: owner.workspaceId,
      walletId: loanId,
      transactionDate: new Date(date),
      counterpartyName: 'ACME Bank - Loan payment',
      paymentPurpose: 'Instalment',
      currency: 'USD',
      transactionType: TransactionType.INCOME,
      amount,
      credit: amount,
      debit: null,
      isVerified: true,
      ...overrides,
    });

  beforeAll(async () => {
    const moduleFixture: TestingModule = await e2eTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
    dataSource = moduleFixture.get<DataSource>(DataSource);

    owner = await registerAccount(app, email, 'Member One');
    const loan = await call('post', '/wallets', 201, {
      name: 'ACME Bank - Car loan',
      type: 'loan',
      currency: 'USD',
      initialBalance: -principal,
    });
    loanId = loan.body.id;
    const checking = await call('post', '/wallets', 201, {
      name: 'ACME Bank - Everyday',
      type: 'checking',
      currency: 'USD',
    });
    checkingId = checking.body.id;
  });

  afterAll(async () => {
    if (dataSource) await deleteUserByEmail(dataSource, email);
    await app.close();
  });

  it('answers no terms until they are set, and refuses them on a non-debt account', async () => {
    const empty = await call('get', `/wallets/${loanId}/loan-terms`, 200);
    matches(LoanTermsState, empty.body);
    expect(empty.body.terms).toBeNull();
    await call('get', `/wallets/${loanId}/loan-schedule`, 404);

    const refused = await call('put', `/wallets/${checkingId}/loan-terms`, 400, terms);
    expect(refused.body.error?.code).toBe('LOAN_TERMS_DEBT_ONLY');
    await call('put', `/wallets/${loanId}/loan-terms`, 400, { ...terms, paymentDay: 32 });
    // Under a cent would round to nothing in the column: refused before it gets there.
    await call('put', `/wallets/${loanId}/loan-terms`, 400, { ...terms, principal: 0.001 });
  });

  it('stores the terms in the account currency and replaces them on a second save', async () => {
    const saved = await call('put', `/wallets/${loanId}/loan-terms`, 200, terms);
    matches(LoanTermsState, saved.body);
    expect(saved.body.terms).toMatchObject({
      walletId: loanId,
      currency: 'USD',
      principal: '12000.00',
      annualRate: '6.0000',
      startDate: '2026-01-10',
      rateChanges: terms.rateChanges,
      extraPayments: terms.extraPayments,
      recurringExtra: null,
      extraMode: 'reduce_term',
      autoSplit: false,
    });

    const again = await call('put', `/wallets/${loanId}/loan-terms`, 200, {
      ...terms,
      recurringExtra: { amount: 50, from: '2027-01-10' },
    });
    expect(again.body.terms.id).toBe(saved.body.terms.id);
    expect(again.body.terms.recurringExtra).toEqual({ amount: 50, from: '2027-01-10' });
    const [{ count }] = await dataSource.query(
      'SELECT COUNT(*)::int AS count FROM loan_terms WHERE wallet_id = $1',
      [loanId],
    );
    expect(count).toBe(1);
    await call('put', `/wallets/${loanId}/loan-terms`, 200, terms);
  });

  it('holds the real balance from counted rows against the plan, and projects from it', async () => {
    const before = await call('get', `/wallets/${loanId}/loan-schedule`, 200);
    matches(LoanSchedule, before.body);
    const rows = before.body.plan.rows as Array<{ date: string; principal: number; balance: number }>;
    expect(rows[0].date).toBe('2026-02-10');

    // The first three instalments paid exactly on plan; a row still in Review
    // and a duplicate do not count.
    await dataSource.getRepository(Transaction).save([
      ...rows.slice(0, 3).map(row => payment(row.date, row.principal)),
      payment(rows[0].date, 5_000, { isVerified: false }),
      payment(rows[1].date, 4_000, { isDuplicate: true }),
    ]);

    const after = await call('get', `/wallets/${loanId}/loan-schedule`, 200);
    matches(LoanSchedule, after.body);
    const { plan, actual, projection, today } = after.body;
    expect(plan.periods).toBeGreaterThan(0);
    for (const row of plan.rows.slice(0, 3)) {
      expect(row.actualBalance).toBe(row.balance);
    }
    for (const row of plan.rows.filter((item: { date: string }) => item.date > today)) {
      expect(row.actualBalance).toBeNull();
    }
    const owed = Math.round((principal - rows.slice(0, 3).reduce((s, r) => s + r.principal, 0)) * 100) / 100;
    expect(actual.balance).toBe(owed);
    expect(actual.difference).toBe(Math.round((owed - actual.plannedBalance) * 100) / 100);
    expect(projection.startBalance).toBe(owed);
    expect(projection.from <= today).toBe(true);
    expect(projection.rows[0].date > today).toBe(true);
  });

  it('works out a what-if in both modes without saving it', async () => {
    const shorter = await call('post', `/wallets/${loanId}/loan-schedule/what-if`, 200, {
      recurringExtra: { amount: 200, from: '2026-02-10' },
      mode: 'reduce_term',
    });
    matches(LoanWhatIf, shorter.body);
    expect(shorter.body.monthsSaved).toBeGreaterThan(0);
    expect(shorter.body.interestSaved).toBeGreaterThan(0);

    const lower = await call('post', `/wallets/${loanId}/loan-schedule/what-if`, 200, {
      extraPayments: [{ date: '2026-04-10', amount: 2_000 }],
      mode: 'reduce_payment',
    });
    matches(LoanWhatIf, lower.body);
    expect(lower.body.paymentAfter).toBeLessThan(lower.body.paymentBefore);

    const stored = await call('get', `/wallets/${loanId}/loan-terms`, 200);
    expect(stored.body.terms.extraPayments).toEqual(terms.extraPayments);
  });

  it('lists the payments with the schedule’s split, splits one and joins it back', async () => {
    const listed = await call('get', `/wallets/${loanId}/loan-payments`, 200);
    matches(LoanPayments, listed.body);
    expect(listed.body).toMatchObject({ currency: 'USD', autoSplit: false });
    // The three counted instalments and the one still in Review; the duplicate is not a payment.
    expect(listed.body.items).toHaveLength(4);
    const first = listed.body.items.find(
      (item: { isVerified: boolean; suggestion: { period: number | null } | null }) =>
        item.isVerified && item.suggestion?.period === 1,
    );
    // Paid only the principal of the first instalment: the interest is capped at the payment.
    const interest = first.suggestion.interest;
    expect(interest).toBe(Math.min(60, first.amount));

    const split = await call(
      'post',
      `/wallets/${loanId}/loan-payments/${first.transactionId}/split`,
      200,
      { interest },
    );
    matches(LoanPaymentItem, split.body);
    expect(split.body.split).toMatchObject({ interest, principal: 0 });
    const after = await call('get', `/wallets/${loanId}/loan-payments`, 200);
    matches(LoanPayments, after.body);
    expect(after.body.totals.interest).toBe(interest);

    const joined = await call(
      'delete',
      `/wallets/${loanId}/loan-payments/${first.transactionId}/split`,
      200,
    );
    matches(MessageResult, joined.body);
  });

  it('removes the terms', async () => {
    matches(MessageResult, (await call('delete', `/wallets/${loanId}/loan-terms`, 200)).body);
    expect((await call('get', `/wallets/${loanId}/loan-terms`, 200)).body.terms).toBeNull();
    await call('get', `/wallets/${loanId}/loan-schedule`, 404);
  });
});
