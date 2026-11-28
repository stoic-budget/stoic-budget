vi.mock('franc', () => ({
  franc: () => 'und',
}));

import { type INestApplication, ValidationPipe } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import { Schema } from 'effect';
import request from 'supertest';
import { DataSource, IsNull, Not } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { LoanTermsState, Payable as PayableContract } from '../../src/contracts';
import { Payable, PayableStatus } from '../../src/entities/payable.entity';
import { Transaction, TransactionType } from '../../src/entities/transaction.entity';
import { LoanRemindersService } from '../../src/modules/loans/loan-reminders.service';
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
  extra: number;
}

const day = (date: Date) => date.toISOString().slice(0, 10);

/**
 * Loan payments as repeating bills: a loan whose terms ask for reminders gets
 * one bill series that follows its schedule, so the bills' reminders, overdue
 * notices, dashboard and forecast cover it. Paid from an account, the bill
 * moves the money into the loan; money reaching the loan account pays it; the
 * terms own the rule, and turning reminders off takes the open bills away.
 */
describe('Loan payment reminders (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let reminders: LoanRemindersService;
  const stamp = Date.now();
  const emails = {
    owner: `loan-remind-owner-${stamp}@example.com`,
    other: `loan-remind-other-${stamp}@example.com`,
  };
  let owner: E2eAccount;
  let other: E2eAccount;
  let currency: string;
  let loanId: string;
  let checkingId: string;
  let rows: PlanRow[];
  const loanName = 'ACME Bank - Car loan';
  const today = day(new Date());

  // Three payments behind, nine ahead: the series starts at the first one from today.
  const start = new Date();
  start.setUTCDate(1);
  start.setUTCMonth(start.getUTCMonth() - 3);
  const terms = {
    principal: 12_000,
    startDate: day(start),
    termMonths: 12,
    paymentDay: 28,
    method: 'annuity',
    dayCount: '30/360',
    annualRate: 6,
    remindDaysBefore: 3,
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
  const loanBills = () =>
    dataSource.getRepository(Payable).find({
      where: { workspaceId: owner.workspaceId, loanWalletId: loanId },
      order: { occurrenceDate: 'ASC' },
    });
  const openBills = async () =>
    (await loanBills()).filter(bill => bill.status !== PayableStatus.PAID);
  const balance = async (walletId: string) =>
    (await call('get', `/wallets/${walletId}`, 200)).body.balance as number;
  const ahead = () => rows.filter(row => row.date >= today);

  beforeAll(async () => {
    const moduleFixture: TestingModule = await e2eTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
    dataSource = moduleFixture.get<DataSource>(DataSource);
    reminders = moduleFixture.get(LoanRemindersService);

    owner = await registerAccount(app, emails.owner, 'Member One');
    other = await registerAccount(app, emails.other, 'Member Two');
    [{ currency }] = await dataSource.query('SELECT currency FROM workspaces WHERE id = $1', [
      owner.workspaceId,
    ]);
    loanId = (
      await call('post', '/wallets', 201, {
        name: loanName,
        type: 'loan',
        currency,
        initialBalance: -terms.principal,
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
  });

  afterAll(async () => {
    if (dataSource) {
      for (const email of Object.values(emails)) {
        await deleteUserByEmail(dataSource, email);
      }
    }
    await app.close();
  });

  it('saving terms with reminders makes the bill of the next payment date, as the schedule asks', async () => {
    const res = await call('put', `/wallets/${loanId}/loan-terms`, 200, terms);
    matches(LoanTermsState, res.body);
    expect(res.body.terms.remindDaysBefore).toBe(3);
    rows = (await call('get', `/wallets/${loanId}/loan-schedule`, 200)).body.plan.rows;
    const next = ahead()[0];

    const [bill, ...rest] = await loanBills();
    expect(rest).toHaveLength(0);
    expect(bill).toMatchObject({
      vendor: loanName,
      currency: currency.toUpperCase(),
      occurrenceDate: next.date,
      remindDaysBefore: 3,
      status: PayableStatus.TO_PAY,
      recurrence: {
        frequency: 'monthly',
        interval: 1,
        startDate: rows[0].date,
        monthDay: 28,
        count: 12,
      },
    });
    expect(Number(bill.amount)).toBe(next.payment);

    // The bills list hands the link out, so the page can say whose bill it is.
    const read = await call('get', `/payables/${bill.id}`, 200);
    matches(PayableContract, read.body);
    expect(read.body.loanWalletId).toBe(loanId);
    // Another workspace sees none of it.
    await call('get', `/payables/${bill.id}`, 404, undefined, other);
  });

  it('a second save changes nothing: one series, one bill', async () => {
    await call('put', `/wallets/${loanId}/loan-terms`, 200, terms);
    await reminders.syncAll();
    expect(await loanBills()).toHaveLength(1);
  });

  it('the bill form cannot change the rule or stop the series: the terms own it', async () => {
    const [bill] = await loanBills();
    const put = await call('put', `/payables/${bill.id}`, 400, { recurrence: null });
    expect(put.body.error?.code ?? put.body.code).toBe('PAYABLE_LOAN_MANAGED');
    const stop = await call('put', `/payables/${bill.id}/occurrence`, 400, { action: 'stop' });
    expect(stop.body.error?.code ?? stop.body.code).toBe('PAYABLE_LOAN_MANAGED');
  });

  it('paid from checking, the money moves into the loan account and nothing is spent', async () => {
    const [bill] = await loanBills();
    const amount = Number(bill.amount);
    const before = { checking: await balance(checkingId), loan: await balance(loanId) };

    await call('put', `/payables/${bill.id}/mark-paid`, 200, {
      payFromWalletId: checkingId,
      paidOn: today,
    });

    expect(await balance(checkingId)).toBeCloseTo(before.checking - amount, 2);
    expect(await balance(loanId)).toBeCloseTo(before.loan + amount, 2);
    const paid = await dataSource.getRepository(Payable).findOneByOrFail({ id: bill.id });
    expect(paid.status).toBe(PayableStatus.PAID);
    const out = await dataSource
      .getRepository(Transaction)
      .findOneByOrFail({ id: paid.linkedTransactionId as string });
    expect(out).toMatchObject({
      walletId: checkingId,
      transactionType: TransactionType.EXPENSE,
      categoryId: null,
    });
    expect(out.transferPairId).not.toBeNull();
    const legs = await dataSource
      .getRepository(Transaction)
      .findBy({ transferPairId: out.transferPairId as string });
    expect(legs.map(leg => leg.walletId).sort()).toEqual([checkingId, loanId].sort());

    // Its other leg is the payment already: the morning job pays nothing more with it.
    await reminders.syncAll();
    const next = await openBills();
    expect(next).toHaveLength(1);
    expect(next[0].occurrenceDate).toBe(ahead()[1].date);
    expect(Number(next[0].paidAmount)).toBe(0);
  });

  it('a payment that reaches the loan account pays the bill of its date', async () => {
    const [bill] = await openBills();
    const due = bill.occurrenceDate as string;
    const amount = Number(bill.amount);
    const [row] = await dataSource.getRepository(Transaction).save([
      dataSource.getRepository(Transaction).create({
        workspaceId: owner.workspaceId,
        walletId: loanId,
        transactionDate: new Date(due),
        transactionType: TransactionType.INCOME,
        amount,
        credit: amount,
        debit: null,
        currency,
        counterpartyName: 'ACME Bank - Loan payment',
        paymentPurpose: 'Instalment',
        isVerified: true,
      }),
    ]);

    await reminders.settleWorkspace(owner.workspaceId);

    const settled = await dataSource.getRepository(Payable).findOneByOrFail({ id: bill.id });
    expect(settled.status).toBe(PayableStatus.PAID);
    expect(settled.linkedTransactionId).toBe(row.id);
    // Run again: the row already pays a bill, so no other bill takes it.
    await reminders.settleWorkspace(owner.workspaceId);
    const open = await openBills();
    expect(open.every(item => Number(item.paidAmount) === 0)).toBe(true);
  });

  it('a payment day that moves takes the untouched bill with it; the paid ones stay', async () => {
    await call('put', `/wallets/${loanId}/loan-terms`, 200, { ...terms, paymentDay: 10 });
    rows = (await call('get', `/wallets/${loanId}/loan-schedule`, 200)).body.plan.rows;
    const bills = await loanBills();
    const paid = bills.filter(bill => bill.status === PayableStatus.PAID);
    const open = bills.filter(bill => bill.status !== PayableStatus.PAID);
    expect(paid).toHaveLength(2);
    expect(open).toHaveLength(1);
    expect(open[0].occurrenceDate?.slice(8)).toBe('10');
    expect(rows.map(row => row.date)).toContain(open[0].occurrenceDate);
  });

  it('reminders off: the open bills go, the paid ones stay, and the series stops', async () => {
    const { remindDaysBefore: _off, ...withoutReminders } = terms;
    await call('put', `/wallets/${loanId}/loan-terms`, 200, withoutReminders);
    const bills = await loanBills();
    expect(bills).toHaveLength(2);
    expect(bills.every(bill => bill.status === PayableStatus.PAID)).toBe(true);
    expect(bills.every(bill => bill.recurrence === null)).toBe(true);
    await reminders.syncAll();
    expect(await loanBills()).toHaveLength(2);
  });

  it('a deleted loan account ends its series and leaves the paid bills as plain ones', async () => {
    await call('put', `/wallets/${loanId}/loan-terms`, 200, terms);
    expect((await openBills()).length).toBe(1);
    await call('delete', `/wallets/${loanId}`, 200);
    const left = await dataSource.getRepository(Payable).find({
      where: { workspaceId: owner.workspaceId, seriesId: Not(IsNull()) },
    });
    expect(left.every(bill => bill.status === PayableStatus.PAID)).toBe(true);
    expect(left.every(bill => bill.loanWalletId === null && bill.recurrence === null)).toBe(true);
  });

  describe('the edges', () => {
    /** A fresh debt account with the terms above, reminders on. */
    const newLoan = async (type: 'loan' | 'credit_card' = 'loan') => {
      const id = (
        await call('post', '/wallets', 201, {
          name: `ACME Bank - ${type} ${Math.random().toString(36).slice(2, 7)}`,
          type,
          currency,
          initialBalance: -terms.principal,
        })
      ).body.id as string;
      await call('put', `/wallets/${id}/loan-terms`, 200, terms);
      return id;
    };
    const billsOf = (walletId: string) =>
      dataSource.getRepository(Payable).find({
        where: { workspaceId: owner.workspaceId, loanWalletId: walletId },
        order: { occurrenceDate: 'ASC' },
      });
    const incomingRow = (walletId: string, date: string, amount: number) =>
      dataSource.getRepository(Transaction).save(
        dataSource.getRepository(Transaction).create({
          workspaceId: owner.workspaceId,
          walletId,
          transactionDate: new Date(date),
          transactionType: TransactionType.INCOME,
          amount,
          credit: amount,
          debit: null,
          currency,
          counterpartyName: 'ACME Store - Refund',
          paymentPurpose: 'Refund',
          isVerified: true,
        }),
      );
    const addDays = (date: string, days: number) => {
      const at = new Date(`${date}T00:00:00Z`);
      at.setUTCDate(at.getUTCDate() + days);
      return day(at);
    };

    it('syncs at once start one series, not several', async () => {
      const id = await newLoan();
      await dataSource.query('DELETE FROM payables WHERE loan_wallet_id = $1', [id]);
      await Promise.all(Array.from({ length: 6 }, () => reminders.sync(owner.workspaceId, id)));
      const bills = await billsOf(id);
      expect(bills).toHaveLength(1);
    });

    it('a second series of a loan, left by a race, is ended by the next sync', async () => {
      const id = await newLoan();
      const [bill] = await billsOf(id);
      await dataSource.query(
        `INSERT INTO payables (workspace_id, direction, vendor, amount, currency, due_date, status,
                               source, is_recurring, recurrence, series_id, occurrence_date,
                               remind_days_before, loan_wallet_id)
         SELECT workspace_id, direction, vendor, amount, currency, due_date, status, source,
                is_recurring, recurrence, gen_random_uuid(), occurrence_date, remind_days_before,
                loan_wallet_id
           FROM payables WHERE id = $1`,
        [bill.id],
      );
      expect(await billsOf(id)).toHaveLength(2);
      await reminders.sync(owner.workspaceId, id);
      const left = await billsOf(id);
      expect(left).toHaveLength(1);
      expect(left[0].recurrence).not.toBeNull();
    });

    it('a bill with the person own comment or tag is kept when reminders end', async () => {
      const id = await newLoan();
      const [bill] = await billsOf(id);
      await call('put', `/payables/${bill.id}`, 200, { comment: 'Paid by the second card' });
      const { remindDaysBefore: _off, ...withoutReminders } = terms;
      await call('put', `/wallets/${id}/loan-terms`, 200, withoutReminders);
      const left = await billsOf(id);
      expect(left.map(item => item.id)).toEqual([bill.id]);
      expect(left[0].comment).toBe('Paid by the second card');
      expect(left[0].recurrence).toBeNull();
    });

    it('a payment taken back stays taken back: the matcher does not book it again', async () => {
      const id = await newLoan();
      const [bill] = await billsOf(id);
      await call('put', `/payables/${bill.id}/mark-paid`, 200, {
        payFromWalletId: checkingId,
        paidOn: today,
      });
      const payments = (await call('get', `/payables/${bill.id}/payments`, 200)).body as Array<{
        id: string;
      }>;
      await call('delete', `/payables/${bill.id}/payments/${payments[0].id}`, 200);
      await reminders.settleWorkspace(owner.workspaceId);
      await reminders.syncAll();
      const after = await dataSource.getRepository(Payable).findOneByOrFail({ id: bill.id });
      expect(after.status).not.toBe(PayableStatus.PAID);
      expect(Number(after.paidAmount)).toBe(0);
    });

    it('a loan bill cannot be paid from the loan account itself', async () => {
      const id = await newLoan();
      const [bill] = await billsOf(id);
      const res = await call('put', `/payables/${bill.id}/mark-paid`, 400, {
        payFromWalletId: id,
        paidOn: today,
      });
      expect(res.body.error?.code ?? res.body.code).toBe('PAYABLE_LOAN_PAID_FROM_ITSELF');
    });

    it('on a card, even a large refund does not pay the instalment; a transfer from an account does', async () => {
      const id = await newLoan('credit_card');
      const [bill] = await billsOf(id);
      await incomingRow(id, bill.occurrenceDate as string, Number(bill.amount) * 3);
      await reminders.settleWorkspace(owner.workspaceId);
      expect((await dataSource.getRepository(Payable).findOneByOrFail({ id: bill.id })).status).toBe(
        PayableStatus.TO_PAY,
      );
      // The card repaid from checking, the two legs paired as a transfer.
      const amount = Number(bill.amount);
      const pair = '00000000-0000-4000-8000-000000000001';
      await dataSource.getRepository(Transaction).save([
        dataSource.getRepository(Transaction).create({
          workspaceId: owner.workspaceId,
          walletId: checkingId,
          transactionDate: new Date(bill.occurrenceDate as string),
          transactionType: TransactionType.EXPENSE,
          amount,
          debit: amount,
          credit: null,
          currency,
          counterpartyName: 'ACME Bank - Card repayment',
          paymentPurpose: 'Card repayment',
          isVerified: true,
          transferPairId: pair,
        }),
        dataSource.getRepository(Transaction).create({
          workspaceId: owner.workspaceId,
          walletId: id,
          transactionDate: new Date(bill.occurrenceDate as string),
          transactionType: TransactionType.INCOME,
          amount,
          credit: amount,
          debit: null,
          currency,
          counterpartyName: 'ACME Bank - Card repayment',
          paymentPurpose: 'Card repayment',
          isVerified: true,
          transferPairId: pair,
        }),
      ]);
      await reminders.settleWorkspace(owner.workspaceId);
      expect((await dataSource.getRepository(Payable).findOneByOrFail({ id: bill.id })).status).toBe(
        PayableStatus.PAID,
      );
    });

    it('deleting the payment from checking takes its loan leg too, and the bill is owed again', async () => {
      const id = await newLoan();
      const [bill] = await billsOf(id);
      const debt = await balance(id);
      await call('put', `/payables/${bill.id}/mark-paid`, 200, {
        payFromWalletId: checkingId,
        paidOn: today,
      });
      const paid = await dataSource.getRepository(Payable).findOneByOrFail({ id: bill.id });
      const out = await dataSource
        .getRepository(Transaction)
        .findOneByOrFail({ id: paid.linkedTransactionId as string });
      await call('delete', `/transactions/${out.id}`, 204);
      expect(
        await dataSource.getRepository(Transaction).countBy({
          transferPairId: out.transferPairId as string,
        }),
      ).toBe(0);
      expect(await balance(id)).toBeCloseTo(debt, 2);
      // The event's listener reopens it; asked again here so the test does not race it.
      await reminders.reopenDeleted(owner.workspaceId);
      const owed = await dataSource.getRepository(Payable).findOneByOrFail({ id: bill.id });
      expect(owed.status).not.toBe(PayableStatus.PAID);
      expect(Number(owed.paidAmount)).toBe(0);
    });

    it('the next bill made on paying takes the schedule amount of its own date', async () => {
      // Linear: every payment is a different amount, so the paid one's cannot pass for the next.
      const id = (
        await call('post', '/wallets', 201, {
          name: 'ACME Bank - Linear loan',
          type: 'loan',
          currency,
          initialBalance: -terms.principal,
        })
      ).body.id as string;
      await call('put', `/wallets/${id}/loan-terms`, 200, { ...terms, method: 'linear' });
      const plan: PlanRow[] = (await call('get', `/wallets/${id}/loan-schedule`, 200)).body.plan
        .rows;
      const [bill] = await billsOf(id);
      await call('put', `/payables/${bill.id}/mark-paid`, 200, {
        payFromWalletId: checkingId,
        paidOn: today,
      });
      await reminders.afterPaid(owner.workspaceId, bill.id);
      const next = (await billsOf(id)).find(item => item.id !== bill.id);
      const row = plan.find(item => item.date === next?.occurrenceDate);
      expect(row).toBeDefined();
      expect(Number(next?.amount)).toBeCloseTo((row?.payment ?? 0) + (row?.extra ?? 0), 2);
      expect(Number(next?.amount)).not.toBeCloseTo(Number(bill.amount), 2);
    });

    it('a refund on a card paid in instalments does not pay the instalment', async () => {
      const id = await newLoan('credit_card');
      const [bill] = await billsOf(id);
      await incomingRow(id, bill.occurrenceDate as string, 15);
      await reminders.settleWorkspace(owner.workspaceId);
      const after = await dataSource.getRepository(Payable).findOneByOrFail({ id: bill.id });
      expect(after.status).toBe(PayableStatus.TO_PAY);
      expect(Number(after.paidAmount)).toBe(0);
    });

    it('an amount typed into the bill stays its own; the schedule does not put it back', async () => {
      const id = await newLoan();
      const [bill] = await billsOf(id);
      const typed = Number(bill.amount) + 7.3;
      await call('put', `/payables/${bill.id}`, 200, { amount: typed });
      await reminders.syncAll();
      const after = await dataSource.getRepository(Payable).findOneByOrFail({ id: bill.id });
      expect(Number(after.amount)).toBeCloseTo(typed, 2);
    });

    it('paid in hand, the money reaches the loan and nothing is spent', async () => {
      const id = await newLoan();
      const [bill] = await billsOf(id);
      const before = await balance(id);
      await call('put', `/payables/${bill.id}/mark-paid`, 200, { inHand: true, paidOn: today });
      expect(await balance(id)).toBeCloseTo(before + Number(bill.amount), 2);
      const paid = await dataSource.getRepository(Payable).findOneByOrFail({ id: bill.id });
      const row = await dataSource
        .getRepository(Transaction)
        .findOneByOrFail({ id: paid.linkedTransactionId as string });
      expect(row).toMatchObject({ walletId: id, transactionType: TransactionType.INCOME });
    });

    it('a late payment from checking does not pay the next bill through its loan leg too', async () => {
      const id = await newLoan();
      const [bill] = await billsOf(id);
      const late = addDays(bill.occurrenceDate as string, 20);
      await call('put', `/payables/${bill.id}/mark-paid`, 200, {
        payFromWalletId: checkingId,
        paidOn: late,
      });
      await reminders.syncAll();
      const next = (await billsOf(id)).find(item => item.id !== bill.id);
      expect(next).toBeDefined();
      // The next one is due about ten days after the late payment: inside the window.
      expect(Math.abs(new Date(next?.dueDate as unknown as string).getTime() - new Date(late).getTime()))
        .toBeLessThan(16 * 86_400_000);
      expect(next?.status).toBe(PayableStatus.TO_PAY);
      expect(Number(next?.paidAmount)).toBe(0);
    });
  });
});
