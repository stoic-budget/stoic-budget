vi.mock('franc', () => ({
  franc: () => 'und',
}));

import { type INestApplication, ValidationPipe } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import { Schema } from 'effect';
import request from 'supertest';
import { DataSource, type QueryRunner } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { LoanSchedule, LoanTermsState, LoanWhatIf, MessageResult } from '../../src/contracts';
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
    // Past what the schedule can add up exactly in cents.
    await call('put', `/wallets/${loanId}/loan-terms`, 400, { ...terms, principal: 1e12 });
    await call('put', `/wallets/${loanId}/loan-terms`, 400, {
      ...terms,
      extraPayments: [{ date: '2027-03-10', amount: 1e12 }],
    });
    // Finer than the rate column keeps: refused, so a rate change stores what the rate does.
    await call('put', `/wallets/${loanId}/loan-terms`, 400, { ...terms, annualRate: 6.12345 });
    await call('put', `/wallets/${loanId}/loan-terms`, 400, {
      ...terms,
      rateChanges: [{ from: '2027-06-10', annualRate: 4.56789 }],
    });
    // A last payment past the year 9999 has no date to answer.
    const late = await call('put', `/wallets/${loanId}/loan-terms`, 400, {
      ...terms,
      startDate: '9990-06-15',
      termMonths: 600,
    });
    expect(late.body.error?.code).toBe('LOAN_TERMS_END_TOO_LATE');
    // Under a cent of principal a month at 30% over 50 years: rounded, it never repays.
    const steep = await call('put', `/wallets/${loanId}/loan-terms`, 400, {
      ...terms,
      principal: 1_000,
      annualRate: 30,
      termMonths: 600,
      rateChanges: [],
    });
    expect(steep.body.error?.code).toBe('LOAN_TERMS_ROUNDING');
    expect((await call('get', `/wallets/${loanId}/loan-terms`, 200)).body.terms).toBeNull();
  });

  it('works out the largest loan at the highest rate to its last day', async () => {
    const largest = 999_999_999_999.99;
    const saved = await call('put', `/wallets/${loanId}/loan-terms`, 200, {
      ...terms,
      principal: largest,
      startDate: '9949-12-31',
      termMonths: 600,
      paymentDay: 31,
      method: 'interest_only',
      dayCount: 'actual/365',
      annualRate: 100,
      rateChanges: [],
      extraPayments: [],
    });
    expect(saved.body.terms.principal).toBe('999999999999.99');
    const schedule = await call('get', `/wallets/${loanId}/loan-schedule`, 200);
    matches(LoanSchedule, schedule.body);
    expect(schedule.body.plan.payoffDate).toBe('9999-12-31');
    expect(schedule.body.plan.periods).toBe(600);
    const whatIf = await call('post', `/wallets/${loanId}/loan-schedule/what-if`, 200, {
      extraPayments: [{ date: '9950-01-31', amount: largest }],
      mode: 'reduce_term',
    });
    matches(LoanWhatIf, whatIf.body);
    expect(whatIf.body.scenario.periods).toBe(1);
    expect(whatIf.body.interestSaved).toBeGreaterThan(0);
    await call('delete', `/wallets/${loanId}/loan-terms`, 200);
  });

  it('stores the terms in the account currency and replaces them on a second save', async () => {
    // Four decimals, as the rate column keeps them: what is read back is what was sent.
    const fine = await call('put', `/wallets/${loanId}/loan-terms`, 200, {
      ...terms,
      annualRate: 6.1234,
      rateChanges: [{ from: '2027-06-10', annualRate: 4.5678 }],
    });
    expect(fine.body.terms).toMatchObject({
      annualRate: '6.1234',
      rateChanges: [{ from: '2027-06-10', annualRate: 4.5678 }],
    });
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
      // A currency with no rate (no provider knows it): left out, and named.
      payment(rows[2].date, 700, { currency: 'ZZX' }),
    ]);

    const after = await call('get', `/wallets/${loanId}/loan-schedule`, 200);
    matches(LoanSchedule, after.body);
    const { plan, actual, projection, today } = after.body;
    expect(before.body.unconvertedCurrencies).toEqual([]);
    expect(after.body.unconvertedCurrencies).toEqual(['ZZX']);
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

    // Owed past what a loan can be: the real balance is shown, but nothing is projected from it.
    const charge = 5e12;
    await dataSource
      .getRepository(Transaction)
      .save(payment(today, charge, { transactionType: TransactionType.EXPENSE, credit: null, debit: charge }));
    const overdrawn = await call('get', `/wallets/${loanId}/loan-schedule`, 200);
    matches(LoanSchedule, overdrawn.body);
    expect(overdrawn.body.actual.balance).toBeGreaterThan(charge);
    expect(overdrawn.body.projection).toBeNull();
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

  it('removes the terms', async () => {
    matches(MessageResult, (await call('delete', `/wallets/${loanId}/loan-terms`, 200)).body);
    expect((await call('get', `/wallets/${loanId}/loan-terms`, 200)).body.terms).toBeNull();
    await call('get', `/wallets/${loanId}/loan-schedule`, 404);
  });

  describe('a type change racing a save of the terms', () => {
    const termsOf = async (walletId: string) =>
      (
        await dataSource.query('SELECT COUNT(*)::int AS count FROM loan_terms WHERE wallet_id = $1', [
          walletId,
        ])
      )[0].count;
    const send = (method: 'put', url: string, body: object) =>
      request(app.getHttpServer())
        [method](url)
        .set('Authorization', `Bearer ${owner.token}`)
        .set('x-workspace-id', owner.workspaceId)
        .send(body)
        .then(response => response);
    const newLoan = async () =>
      (
        await call('post', '/wallets', 201, {
          name: 'ACME Bank - Second loan',
          type: 'loan',
          currency: 'USD',
          initialBalance: -1_000,
        })
      ).body.id as string;

    /** Holds the account row as another request would, runs `inside`, then lets go. */
    const holding = async (walletId: string, inside: (runner: QueryRunner) => Promise<void>) => {
      const runner = dataSource.createQueryRunner();
      await runner.connect();
      await runner.startTransaction();
      try {
        await runner.query('SELECT id FROM wallets WHERE id = $1 FOR UPDATE', [walletId]);
        await inside(runner);
        await runner.commitTransaction();
      } finally {
        await runner.release();
      }
    };
    const pause = () => new Promise(resolve => setTimeout(resolve, 500));

    it('refuses terms for an account that stopped being a debt while the save waited', async () => {
      const walletId = await newLoan();
      let saving: Promise<request.Response> | undefined;
      await holding(walletId, async runner => {
        saving = send('put', `/wallets/${walletId}/loan-terms`, terms);
        await pause();
        await runner.query("UPDATE wallets SET type = 'checking' WHERE id = $1", [walletId]);
      });
      const saved = await saving;
      expect(saved?.status).toBe(400);
      expect(saved?.body.error?.code).toBe('LOAN_TERMS_DEBT_ONLY');
      expect(await termsOf(walletId)).toBe(0);
    });

    it('deletes terms saved while the type change waited', async () => {
      const walletId = await newLoan();
      let changing: Promise<request.Response> | undefined;
      await holding(walletId, async runner => {
        // A save of terms that has passed its check and holds the row.
        await runner.query(
          `INSERT INTO loan_terms (workspace_id, wallet_id, principal, start_date, term_months,
             payment_day, method, day_count, annual_rate)
           VALUES ($1, $2, 1000, '2026-01-10', 12, 10, 'annuity', '30/360', 6)`,
          [owner.workspaceId, walletId],
        );
        changing = send('put', `/wallets/${walletId}`, { type: 'checking' });
        await pause();
      });
      expect((await changing)?.status).toBe(200);
      expect(await termsOf(walletId)).toBe(0);
    });
  });

  it('keeps the terms from one debt type to another, deletes them when the account stops being a debt', async () => {
    await call('put', `/wallets/${loanId}/loan-terms`, 200, terms);
    const count = async () =>
      (
        await dataSource.query('SELECT COUNT(*)::int AS count FROM loan_terms WHERE wallet_id = $1', [
          loanId,
        ])
      )[0].count;

    await call('put', `/wallets/${loanId}`, 200, { type: 'credit_card' });
    expect((await call('get', `/wallets/${loanId}/loan-terms`, 200)).body.terms).not.toBeNull();

    const changed = await call('put', `/wallets/${loanId}`, 200, { type: 'checking' });
    expect(changed.body.type).toBe('checking');
    expect(await count()).toBe(0);
    expect((await call('get', `/wallets/${loanId}/loan-terms`, 200)).body.terms).toBeNull();
    await call('get', `/wallets/${loanId}/loan-schedule`, 404);
  });
});
