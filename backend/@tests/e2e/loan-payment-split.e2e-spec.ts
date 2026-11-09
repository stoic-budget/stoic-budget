vi.mock('franc', () => ({
  franc: () => 'und',
}));

import { randomUUID } from 'node:crypto';
import { type INestApplication, ValidationPipe } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import { Schema } from 'effect';
import request from 'supertest';
import { DataSource, In } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { LoanPaymentItem, LoanPayments, LoanTermsState } from '../../src/contracts';
import { BankName, FileType, Statement, StatementStatus } from '../../src/entities';
import {
  Transaction,
  TransactionType,
  TransferPairSource,
} from '../../src/entities/transaction.entity';
import { LoanPaymentsEventsListener } from '../../src/modules/loans/loan-payments-events.listener';
import {
  deleteUserByEmail,
  type E2eAccount,
  e2eTestingModule,
  registerAccount,
} from './helpers/e2e-app';

type Method = 'get' | 'post' | 'put' | 'delete';
interface PlanRow {
  date: string;
  payment: number;
  interest: number;
  principal: number;
  balance: number;
  actualBalance: number | null;
}

const cents = (value: number) => Math.round(value * 100);
const money = (value: number) => cents(value) / 100;

/**
 * A loan payment split into principal and interest, end to end. The payment
 * (the incoming leg on the loan account, paired with the checking leg or
 * alone) stays as it came; the interest becomes an expense row on the loan
 * account. Proved on the figures a person reads: both accounts' balances,
 * the month's spending and the loan's real balance against its schedule,
 * before and after the split and after joining it back. Another workspace
 * reaches none of it.
 */
describe('Loan payment split (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const stamp = Date.now();
  const emails = {
    owner: `loan-split-owner-${stamp}@example.com`,
    other: `loan-split-other-${stamp}@example.com`,
  };
  let owner: E2eAccount;
  let other: E2eAccount;
  let currency: string;
  let loanId: string;
  let checkingId: string;
  let rows: PlanRow[];
  let pairedLoanLeg: string;
  let pairedCheckingLeg: string;

  const principal = 12_000;
  const terms = {
    principal,
    startDate: '2026-01-15',
    termMonths: 12,
    paymentDay: 15,
    method: 'annuity',
    dayCount: '30/360',
    annualRate: 6,
  };

  const call = (method: Method, url: string, status: number, body?: object, as = owner) => {
    const req = request(app.getHttpServer())
      [method](url)
      .set('Authorization', `Bearer ${as.token}`)
      .set('x-workspace-id', as.workspaceId);
    return (body ? req.send(body) : req).expect(status);
  };
  const matches = (schema: Schema.Top, body: unknown) =>
    Schema.decodeUnknownSync(schema as Schema.Codec<unknown, unknown>)(body);

  const row = (fields: Partial<Transaction>) =>
    dataSource.getRepository(Transaction).create({
      workspaceId: owner.workspaceId,
      counterpartyName: 'ACME Bank - Loan payment',
      paymentPurpose: 'Instalment',
      currency,
      transactionType: TransactionType.INCOME,
      isVerified: true,
      ...fields,
    });
  const incoming = (walletId: string, date: string, amount: number, fields = {}) =>
    row({ walletId, transactionDate: new Date(date), amount, credit: amount, debit: null, ...fields });
  const outgoing = (walletId: string, date: string, amount: number, fields = {}) =>
    row({
      walletId,
      transactionDate: new Date(date),
      transactionType: TransactionType.EXPENSE,
      amount,
      debit: amount,
      credit: null,
      ...fields,
    });
  const save = (...items: Transaction[]) => dataSource.getRepository(Transaction).save(items);

  const balance = async (walletId: string) =>
    (await call('get', `/wallets/${walletId}`, 200)).body.balance as number;
  /** The spending of a month, as the reports count it. */
  const spending = async (month: string) => {
    const res = await call(
      'get',
      `/reports/top-categories?dateFrom=${month}-01&dateTo=${month}-28`,
      200,
    );
    return res.body.totals.expense as number;
  };
  const payments = async () => {
    const res = await call('get', `/wallets/${loanId}/loan-payments`, 200);
    matches(LoanPayments, res.body);
    return res.body as LoanPayments;
  };
  const itemOf = async (id: string) =>
    (await payments()).items.find(item => item.transactionId === id) as LoanPaymentItem;
  const interestRowsOf = (paymentId: string) =>
    dataSource.getRepository(Transaction).find({ where: { loanInterestOfId: paymentId } });

  beforeAll(async () => {
    const moduleFixture: TestingModule = await e2eTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
    dataSource = moduleFixture.get<DataSource>(DataSource);

    owner = await registerAccount(app, emails.owner, 'Member One');
    other = await registerAccount(app, emails.other, 'Member Two');
    // The workspace's own currency: the reports then need no exchange rate.
    [{ currency }] = await dataSource.query('SELECT currency FROM workspaces WHERE id = $1', [
      owner.workspaceId,
    ]);

    loanId = (
      await call('post', '/wallets', 201, {
        name: 'ACME Bank - Car loan',
        type: 'loan',
        currency,
        initialBalance: -principal,
      })
    ).body.id;
    checkingId = (
      await call('post', '/wallets', 201, {
        name: 'ACME Bank - Everyday',
        type: 'checking',
        currency,
        initialBalance: 5_000,
      })
    ).body.id;
    await call('put', `/wallets/${loanId}/loan-terms`, 200, terms);
    rows = (await call('get', `/wallets/${loanId}/loan-schedule`, 200)).body.plan.rows;
  });

  afterAll(async () => {
    if (dataSource) {
      for (const email of Object.values(emails)) {
        await deleteUserByEmail(dataSource, email);
      }
    }
    await app.close();
  });

  it('splits a transfer into the loan: checking pays it all, the debt falls by principal, interest is spent once', async () => {
    const first = rows[0];
    // 12 000 at 6 % a year, 30/360: the first month's interest is 60.
    expect(first.interest).toBe(60);
    const pairId = randomUUID();
    const [out, into] = await save(
      outgoing(checkingId, first.date, first.payment, { transferPairId: pairId, transferPairSource: TransferPairSource.MANUAL }),
      incoming(loanId, first.date, first.payment, { transferPairId: pairId, transferPairSource: TransferPairSource.MANUAL }),
    );
    pairedCheckingLeg = out.id;
    pairedLoanLeg = into.id;
    const month = first.date.slice(0, 7);

    const before = {
      checking: await balance(checkingId),
      loan: await balance(loanId),
      spent: await spending(month),
    };
    expect(before.checking).toBe(money(5_000 - first.payment));
    // Unsplit, the whole payment came off the debt: ahead of the plan by the interest.
    expect(before.loan).toBe(money(-principal + first.payment));
    const unsplit = await itemOf(pairedLoanLeg);
    expect(unsplit).toMatchObject({
      amount: first.payment,
      fromWallet: { id: checkingId, name: 'ACME Bank - Everyday' },
      split: null,
      blocked: null,
      suggestion: { period: 1, interest: 60, principal: first.principal },
    });
    const planBefore = (await call('get', `/wallets/${loanId}/loan-schedule`, 200)).body.plan
      .rows[0] as PlanRow;
    expect(planBefore.actualBalance).toBe(money(first.balance - 60));

    const res = await call('post', `/wallets/${loanId}/loan-payments/${pairedLoanLeg}/split`, 200, {
      interest: 60,
    });
    matches(LoanPaymentItem, res.body);
    expect(res.body.split).toMatchObject({ interest: 60, principal: first.principal });

    expect(await balance(checkingId)).toBe(before.checking);
    expect(await balance(loanId)).toBe(money(before.loan - 60));
    expect(await spending(month)).toBe(money(before.spent + 60));
    // The real balance now sits on the plan.
    const planAfter = (await call('get', `/wallets/${loanId}/loan-schedule`, 200)).body.plan
      .rows[0] as PlanRow;
    expect(planAfter.actualBalance).toBe(first.balance);

    // The pair is as it came: both legs keep the whole amount and their link.
    const legs = await dataSource.getRepository(Transaction).findBy({ transferPairId: pairId });
    expect(legs.map(leg => Number(leg.amount))).toEqual([first.payment, first.payment]);
    const [interest] = await interestRowsOf(pairedLoanLeg);
    expect(interest).toMatchObject({
      walletId: loanId,
      transactionType: TransactionType.EXPENSE,
      transferPairId: null,
      isVerified: true,
    });
    const [{ system_key }] = await dataSource.query(
      'SELECT system_key FROM categories WHERE id = $1',
      [interest.categoryId],
    );
    expect(system_key).toBe('interest');

    const again = await call('post', `/wallets/${loanId}/loan-payments/${pairedLoanLeg}/split`, 409, {
      interest: 60,
    });
    expect(again.body.error?.code).toBe('LOAN_PAYMENT_ALREADY_SPLIT');
    expect(await interestRowsOf(pairedLoanLeg)).toHaveLength(1);
  });

  it('joins it back: the interest goes, the pair and every figure are as before', async () => {
    const month = rows[0].date.slice(0, 7);
    const spentSplit = await spending(month);
    const loanSplit = await balance(loanId);

    await call('delete', `/wallets/${loanId}/loan-payments/${pairedLoanLeg}/split`, 200);
    expect(await interestRowsOf(pairedLoanLeg)).toHaveLength(0);
    expect(await balance(loanId)).toBe(money(loanSplit + 60));
    expect(await spending(month)).toBe(money(spentSplit - 60));
    expect(await balance(checkingId)).toBe(money(5_000 - rows[0].payment));
    expect((await itemOf(pairedLoanLeg)).split).toBeNull();
    // Joining a payment that is not split changes nothing.
    await call('delete', `/wallets/${loanId}/loan-payments/${pairedLoanLeg}/split`, 200);
  });

  it('splits a payment booked on its own, sending what is paid beyond the plan to principal', async () => {
    const second = rows[1];
    const [single] = await save(incoming(loanId, second.date, second.payment + 500));
    const loanBefore = await balance(loanId);

    const item = await itemOf(single.id);
    expect(item.fromWallet).toBeNull();
    expect(item.suggestion).toMatchObject({ period: 2, interest: second.interest });
    expect(cents(item.suggestion?.principal ?? 0)).toBe(
      cents(second.payment + 500) - cents(second.interest),
    );

    // The interest is edited by hand: the bank charged a little less.
    const res = await call('post', `/wallets/${loanId}/loan-payments/${single.id}/split`, 200, {
      interest: 55.5,
    });
    expect(res.body.split.interest).toBe(55.5);
    expect(await balance(loanId)).toBe(money(loanBefore - 55.5));
  });

  it('refuses what it cannot split, with the reason', async () => {
    const third = rows[2];
    const [inDollars, early, plain] = await save(
      incoming(loanId, third.date, 200, { currency: currency === 'USD' ? 'EUR' : 'USD' }),
      incoming(loanId, '2026-01-10', 200),
      incoming(loanId, third.date, third.payment),
    );

    expect((await itemOf(inDollars.id)).blocked).toBe('other_currency');
    expect((await itemOf(early.id)).blocked).toBe('before_start');
    const split = (id: string, status: number, interest = 10) =>
      call('post', `/wallets/${loanId}/loan-payments/${id}/split`, status, { interest });

    expect((await split(inDollars.id, 400)).body.error?.code).toBe('LOAN_PAYMENT_CURRENCY');
    expect((await split(early.id, 400)).body.error?.code).toBe('LOAN_PAYMENT_BEFORE_START');
    const tooMuch = await split(plain.id, 400, third.payment + 1);
    expect(tooMuch.body.error?.code).toBe('LOAN_PAYMENT_INTEREST_TOO_LARGE');
    // The checking leg is not a payment into the loan.
    expect((await split(pairedCheckingLeg, 404)).body.error?.code).toBe('LOAN_PAYMENT_NOT_FOUND');
    await call('post', `/wallets/${loanId}/loan-payments/${plain.id}/split`, 400, { interest: 0 });
    expect(await interestRowsOf(plain.id)).toHaveLength(0);
  });

  it('counts the interest only while the payment counts', async () => {
    const fourth = rows[3];
    const month = fourth.date.slice(0, 7);
    const [waiting] = await save(incoming(loanId, fourth.date, fourth.payment, { isVerified: false }));
    const spentBefore = await spending(month);
    const loanBefore = await balance(loanId);

    await call('post', `/wallets/${loanId}/loan-payments/${waiting.id}/split`, 200, {
      interest: fourth.interest,
    });
    // Still in Review: neither the payment nor its interest counts yet.
    expect((await interestRowsOf(waiting.id))[0].isVerified).toBe(false);
    expect(await spending(month)).toBe(spentBefore);
    expect(await balance(loanId)).toBe(loanBefore);

    await call('post', '/review-inbox/transactions/approve', 200, { ids: [waiting.id] });
    expect((await interestRowsOf(waiting.id))[0].isVerified).toBe(true);
    expect(await spending(month)).toBe(money(spentBefore + fourth.interest));
    expect(await balance(loanId)).toBe(money(loanBefore + fourth.payment - fourth.interest));

    // Flagged a duplicate, the payment leaves every figure and takes its interest along.
    await dataSource.getRepository(Transaction).update(waiting.id, { isDuplicate: true });
    expect((await interestRowsOf(waiting.id))[0].isDuplicate).toBe(true);
    expect(await spending(month)).toBe(spentBefore);
  });

  it('splits new payments on import only for a loan that asks for it', async () => {
    const fifth = rows[4];
    const [regular, extra, elsewhere] = await save(
      incoming(loanId, fifth.date, fifth.payment, { isVerified: false }),
      incoming(loanId, '2026-06-20', 300, { isVerified: false }),
      incoming(checkingId, fifth.date, 300, { isVerified: false }),
    );
    const listener = app.get(LoanPaymentsEventsListener);
    const imported = {
      workspaceId: owner.workspaceId,
      actorId: owner.userId,
      actorName: 'Member One',
      transactionCount: 3,
      transactionIds: [regular.id, extra.id, elsewhere.id],
    };

    await listener.handleImportCommitted(imported);
    expect(await interestRowsOf(regular.id)).toHaveLength(0);

    const saved = await call('put', `/wallets/${loanId}/loan-terms`, 200, { ...terms, autoSplit: true });
    matches(LoanTermsState, saved.body);
    expect(saved.body.terms.autoSplit).toBe(true);
    expect((await payments()).autoSplit).toBe(true);
    const leftAlone = (await payments()).items.filter(item => !item.split && !item.blocked);

    await listener.handleImportCommitted(imported);
    const [interest] = await interestRowsOf(regular.id);
    expect(Number(interest.amount)).toBe(fifth.interest);
    expect(interest.isVerified).toBe(false);
    // An extra payment has no interest of its own; rows not in the import are left as they are.
    expect(await interestRowsOf(extra.id)).toHaveLength(0);
    for (const item of leftAlone.filter(entry => entry.transactionId !== regular.id)) {
      expect(await interestRowsOf(item.transactionId)).toHaveLength(0);
    }
    // A second run of the same import splits nothing twice.
    await listener.handleImportCommitted(imported);
    expect(await interestRowsOf(regular.id)).toHaveLength(1);
  });

  it('removes the interest with its payment', async () => {
    const [gone] = await save(incoming(loanId, rows[5].date, rows[5].payment));
    await call('post', `/wallets/${loanId}/loan-payments/${gone.id}/split`, 200, {
      interest: rows[5].interest,
    });
    await call('delete', `/transactions/${gone.id}`, 204);
    expect(await interestRowsOf(gone.id)).toHaveLength(0);
  });

  it('counts the interest only while the payment statement does: trash and reading take it out', async () => {
    const period = rows[7];
    const month = period.date.slice(0, 7);
    const statement = await dataSource.getRepository(Statement).save({
      userId: owner.userId,
      workspaceId: owner.workspaceId,
      walletId: loanId,
      fileName: `loan-${stamp}.pdf`,
      filePath: '/dev/null',
      fileType: FileType.PDF,
      fileSize: 1,
      fileHash: `loan-split-${stamp}-${Math.random()}`,
      bankName: BankName.OTHER,
      currency,
      status: StatementStatus.COMPLETED,
    });
    const before = { loan: await balance(loanId), spent: await spending(month) };
    const [payment] = await save(
      incoming(loanId, period.date, period.payment, { statementId: statement.id }),
    );
    await call('post', `/wallets/${loanId}/loan-payments/${payment.id}/split`, 200, {
      interest: period.interest,
    });
    const split = { loan: await balance(loanId), spent: await spending(month) };
    expect(split).toEqual({
      loan: money(before.loan + period.payment - period.interest),
      spent: money(before.spent + period.interest),
    });

    // Still being read: spending leaves the interest out, as it leaves the payment.
    await dataSource.getRepository(Statement).update(statement.id, { status: StatementStatus.PROCESSING });
    expect(await spending(month)).toBe(before.spent);
    await dataSource.getRepository(Statement).update(statement.id, { status: StatementStatus.COMPLETED });
    expect(await spending(month)).toBe(split.spent);

    // In the trash: neither the payment nor its interest counts anywhere.
    await call('delete', `/statements/${statement.id}`, 204);
    expect({ loan: await balance(loanId), spent: await spending(month) }).toEqual(before);
    await call('post', `/statements/${statement.id}/restore`, 201);
    expect({ loan: await balance(loanId), spent: await spending(month) }).toEqual(split);
  });

  it('joins the split back when the payment leaves the loan: moved, made an expense, cut below the interest', async () => {
    const period = rows[8];
    const month = period.date.slice(0, 7);
    const spentBefore = await spending(month);
    const [moved, turned, cut] = await save(
      incoming(loanId, period.date, period.payment),
      incoming(loanId, period.date, period.payment),
      incoming(loanId, period.date, period.payment),
    );
    for (const payment of [moved, turned, cut]) {
      await call('post', `/wallets/${loanId}/loan-payments/${payment.id}/split`, 200, {
        interest: period.interest,
      });
    }
    const loanSplit = await balance(loanId);
    const checkingBefore = await balance(checkingId);
    expect(cents(await spending(month))).toBe(cents(spentBefore + 3 * period.interest));

    // A higher amount keeps the split: what is paid beyond goes to principal.
    await call('put', `/transactions/${cut.id}`, 200, { credit: period.payment + 1 });
    expect((await itemOf(cut.id)).split?.principal).toBe(money(period.payment + 1 - period.interest));

    await call('put', `/transactions/${moved.id}`, 200, { walletId: checkingId });
    await call('put', `/transactions/${turned.id}`, 200, { debit: period.payment, credit: null });
    await call('put', `/transactions/${cut.id}`, 200, { credit: 10 });
    for (const payment of [moved, turned, cut]) {
      expect(await interestRowsOf(payment.id)).toHaveLength(0);
    }
    expect((await itemOf(cut.id)).split).toBeNull();
    expect(await balance(checkingId)).toBe(money(checkingBefore + period.payment));
    // The moved payment left (-P), the turned one now takes money out (-2P), the
    // cut one came to 10 (+1, then -(P + 1) + 10); none carries interest any more.
    expect(await balance(loanId)).toBe(
      money(loanSplit - 4 * period.payment + 3 * period.interest + 10),
    );
    expect(cents(await spending(month))).toBe(cents(spentBefore + period.payment));
  });

  it('keeps every part of split interest with its payment', async () => {
    const period = rows[9];
    const month = period.date.slice(0, 7);
    const spentBefore = await spending(month);
    const [payment] = await save(incoming(loanId, period.date, period.payment));
    await call('post', `/wallets/${loanId}/loan-payments/${payment.id}/split`, 200, {
      interest: period.interest,
    });
    const [interest] = await interestRowsOf(payment.id);
    const half = money(period.interest / 2);
    await call('post', `/transactions/${interest.id}/split`, 200, {
      parts: [{ amount: half }, { amount: money(period.interest - half) }],
    });
    const parts = await interestRowsOf(payment.id);
    expect(parts).toHaveLength(2);
    expect((await itemOf(payment.id)).split).toMatchObject({
      interestTransactionId: interest.id,
      interest: period.interest,
    });

    await dataSource.getRepository(Transaction).update(payment.id, { isDuplicate: true });
    expect((await interestRowsOf(payment.id)).every(part => part.isDuplicate)).toBe(true);
    expect(await spending(month)).toBe(spentBefore);

    await call('delete', `/transactions/${payment.id}`, 204);
    expect(
      await dataSource.getRepository(Transaction).countBy({ id: In(parts.map(part => part.id)) }),
    ).toBe(0);
  });

  it('never offers interest as a leg of some transfer', async () => {
    const period = rows[10];
    const [payment] = await save(incoming(loanId, period.date, period.payment));
    await call('post', `/wallets/${loanId}/loan-payments/${payment.id}/split`, 200, {
      interest: period.interest,
    });
    const [interest] = await interestRowsOf(payment.id);
    // Money in on another account, the interest's amount, the same day.
    const [lookalike] = await save(incoming(checkingId, period.date, period.interest));
    const res = await call('get', `/transactions/${lookalike.id}/transfer-candidates`, 200);
    const ids = (res.body.data as Array<{ id: string }>).map(row => row.id);
    expect(ids).not.toContain(interest.id);
  });

  it('keeps another workspace out', async () => {
    const [target] = await save(incoming(loanId, rows[6].date, rows[6].payment));
    await call('get', `/wallets/${loanId}/loan-payments`, 404, undefined, other);
    await call('post', `/wallets/${loanId}/loan-payments/${target.id}/split`, 404, { interest: 1 }, other);
    await call('delete', `/wallets/${loanId}/loan-payments/${pairedLoanLeg}/split`, 404, undefined, other);

    // Its own loan account with the owner's payment in the path: not found there either.
    const otherLoan = (
      await call('post', '/wallets', 201, { name: 'Other loan', type: 'loan', currency, initialBalance: -1000 }, other)
    ).body.id;
    await call('put', `/wallets/${otherLoan}/loan-terms`, 200, { ...terms, principal: 1000 }, other);
    const crossed = await call(
      'post',
      `/wallets/${otherLoan}/loan-payments/${target.id}/split`,
      404,
      { interest: 1 },
      other,
    );
    expect(crossed.body.error?.code).toBe('LOAN_PAYMENT_NOT_FOUND');
    expect(await interestRowsOf(target.id)).toHaveLength(0);
    expect((await call('get', `/wallets/${otherLoan}/loan-payments`, 200, undefined, other)).body.items).toEqual([]);
  });
});
