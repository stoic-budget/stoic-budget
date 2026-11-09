vi.mock('franc', () => ({
  franc: () => 'und',
}));

import { randomUUID } from 'node:crypto';
import { type INestApplication, ValidationPipe } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { addDays, formatDay } from '../../src/common/recurrence/date-only';
import { nextOccurrence } from '../../src/common/recurrence/recurrence';
import { AppModule } from '../../src/app.module';
import { Payable } from '../../src/entities/payable.entity';
import { AddPayableRecurrence1788210000000 } from '../../src/migrations/1788210000000-AddPayableRecurrence';
import {
  Subscription,
  SubscriptionFrequency,
  SubscriptionStatus,
} from '../../src/entities/subscription.entity';
import { Transaction, TransactionType } from '../../src/entities/transaction.entity';
import { PayableRecurrenceService } from '../../src/modules/payables/payable-recurrence.service';
import { PayablesService } from '../../src/modules/payables/payables.service';
import { UnbookedPaymentsService } from '../../src/modules/payables/unbooked-payments.service';
import {
  deleteUserByEmail,
  type E2eAccount,
  e2eTestingModule,
  registerAccount,
} from './helpers/e2e-app';

/**
 * Repeating bills end to end: the next occurrence appears once when one is
 * paid or comes near, never twice however many runs race for it; one
 * occurrence is skipped, moved or changed without touching the series; the
 * reminder follows each bill's own lead; the dashboard sees the occurrences
 * not made yet. "Not this payment" keeps a refused bank row away from a bill
 * and a subscription for good. Another workspace reaches none of it.
 */
describe('Repeating bills and "not this payment" (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const stamp = Date.now();
  const emails = {
    owner: `recurring-owner-${stamp}@example.com`,
    other: `recurring-other-${stamp}@example.com`,
  };
  let owner: E2eAccount;
  let other: E2eAccount;
  const today = formatDay(new Date());

  const as = (account: E2eAccount, req: request.Test) =>
    req.set('Authorization', `Bearer ${account.token}`).set('x-workspace-id', account.workspaceId);
  const server = () => app.getHttpServer();
  const post = (url: string, body: object, account = owner) =>
    as(account, request(server()).post(url)).send(body);
  const put = (url: string, body: object, account = owner) =>
    as(account, request(server()).put(url)).send(body);

  const series = (seriesId: string) =>
    dataSource.getRepository(Payable).find({
      where: { workspaceId: owner.workspaceId, seriesId },
      order: { occurrenceDate: 'ASC' },
      withDeleted: true,
    });

  /** The listener that makes the next occurrence runs after the payment commits. */
  async function waitForCount(seriesId: string, count: number): Promise<Payable[]> {
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const rows = await series(seriesId);
      if (rows.length >= count) return rows;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    return series(seriesId);
  }

  async function bankRow(merchant: string, amount: number, date = today): Promise<string> {
    const saved = await dataSource.getRepository(Transaction).save({
      workspaceId: owner.workspaceId,
      statementId: null,
      transactionDate: new Date(`${date}T00:00:00.000Z`),
      counterpartyName: merchant,
      paymentPurpose: merchant,
      amount,
      debit: amount,
      credit: null,
      currency: 'KZT',
      transactionType: TransactionType.EXPENSE,
      isVerified: true,
    });
    return saved.id;
  }

  const recurrence = () => app.get(PayableRecurrenceService);

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
  });

  afterAll(async () => {
    if (dataSource) {
      for (const email of Object.values(emails)) {
        await deleteUserByEmail(dataSource, email);
      }
    }
    await app.close();
  });

  describe('a monthly bill', () => {
    const start = addDays(today, 20);
    let firstId: string;

    it('is due on its first date and waits outside the upcoming window', async () => {
      const res = await post('/payables', {
        vendor: 'ACME Power',
        amount: 100,
        currency: 'KZT',
        remindDaysBefore: 5,
        recurrence: { frequency: 'monthly', interval: 1, startDate: start },
      }).expect(201);
      firstId = res.body.id;
      expect(res.body).toMatchObject({
        isRecurring: true,
        seriesId: firstId,
        occurrenceDate: start,
        dueDate: start,
        remindDaysBefore: 5,
        recurrence: { frequency: 'monthly', interval: 1, startDate: start },
      });
      // The next one is a month away: nothing more yet, however often the job runs.
      await recurrence().generateDue();
      await recurrence().generateDue();
      expect(await series(firstId)).toHaveLength(1);
    });

    it('makes the next occurrence once when it is paid', async () => {
      await put(`/payables/${firstId}/mark-paid`, { inHand: true }).expect(200);
      const rows = await waitForCount(firstId, 2);
      expect(rows).toHaveLength(2);
      const next = rows[1];
      expect(next).toMatchObject({ vendor: 'ACME Power', status: 'to_pay', remindDaysBefore: 5 });
      expect(Number(next.amount)).toBe(100);
      expect(String(next.occurrenceDate)).toBe(
        nextOccurrence({ frequency: 'monthly', interval: 1, startDate: start }, start),
      );
      // Paying again, the job, and the listener's repeat all find it already made.
      await put(`/payables/${firstId}/mark-paid`, { inHand: true }).expect(200);
      await recurrence().generateDue();
      await recurrence().ensureSeries(owner.workspaceId, firstId);
      expect(await series(firstId)).toHaveLength(2);
    });

    it('skips one occurrence: not owed, the series goes on with the next', async () => {
      const [, open] = await series(firstId);
      const res = await put(`/payables/${open.id}/occurrence`, { action: 'skip' }).expect(200);
      expect(res.body.status).toBe('archived');
      expect(res.body.skippedAt).toEqual(expect.any(String));
      const rows = await series(firstId);
      expect(rows).toHaveLength(3);
      // Skipping again answers the same bill and makes nothing.
      await put(`/payables/${open.id}/occurrence`, { action: 'skip' }).expect(200);
      expect(await series(firstId)).toHaveLength(3);
    });

    it('moves one occurrence and changes its amount without moving the series', async () => {
      const rows = await series(firstId);
      const open = rows[2];
      const day = String(open.occurrenceDate);
      const moved = await put(`/payables/${open.id}/occurrence`, {
        action: 'move',
        dueDate: addDays(day, 3),
      }).expect(200);
      expect(moved.body).toMatchObject({ dueDate: addDays(day, 3), occurrenceDate: day });
      const changed = await put(`/payables/${open.id}/occurrence`, {
        action: 'amount',
        amount: 140,
      }).expect(200);
      expect(changed.body).toMatchObject({ amount: '140.00', baseAmount: '100.00' });

      // Paid, it makes the next one on the rule's day at the series amount.
      await put(`/payables/${open.id}/mark-paid`, { inHand: true }).expect(200);
      const after = await waitForCount(firstId, 4);
      expect(after).toHaveLength(4);
      expect(Number(after[3].amount)).toBe(100);
      expect(String(after[3].occurrenceDate) > day).toBe(true);
      expect(after[3].baseAmount).toBeNull();
    });

    it('refuses an occurrence action on a settled or one-off bill, and another workspace', async () => {
      await put(`/payables/${firstId}/occurrence`, { action: 'skip' }).expect(409);
      const oneOff = await post('/payables', {
        vendor: 'ACME Repairs',
        amount: 30,
        currency: 'KZT',
        dueDate: today,
      }).expect(201);
      await put(`/payables/${oneOff.body.id}/occurrence`, { action: 'skip' }).expect(400);
      const rows = await series(firstId);
      await put(`/payables/${rows[3].id}/occurrence`, { action: 'skip' }, other).expect(404);
      await put(`/payables/${rows[3].id}/occurrence`, { action: 'move' }).expect(400);
    });

    it('ends the series from an earlier occurrence, so a later copy stops too', async () => {
      const rows = await series(firstId);
      await put(`/payables/${rows[2].id}`, { recurrence: null }).expect(200);
      const newest = (await series(firstId)).at(-1) as Payable;
      expect(newest.recurrence).toBeNull();
      await put(`/payables/${newest.id}/mark-paid`, { inHand: true }).expect(200);
      await recurrence().ensureSeries(owner.workspaceId, firstId);
      expect(await series(firstId)).toHaveLength(4);
    });
  });

  describe('a weekly bill inside the window', () => {
    let seriesId: string;

    it('makes the occurrences that fall within the window, and the dashboard the rest', async () => {
      const res = await post('/payables', {
        vendor: 'ACME Cleaning',
        amount: 25,
        currency: 'KZT',
        recurrence: { frequency: 'weekly', interval: 1, startDate: addDays(today, 1) },
      }).expect(201);
      seriesId = res.body.seriesId;
      const rows = await series(seriesId);
      expect(rows.map(row => String(row.occurrenceDate))).toEqual([
        addDays(today, 1),
        addDays(today, 8),
      ]);

      const commitments = await as(owner, request(server()).get('/dashboard/commitments?days=30'))
        .expect(200);
      const cleaning = commitments.body.items.filter(
        (item: { label: string }) => item.label === 'ACME Cleaning',
      );
      // Two made, and the 15th, 22nd and 29th day projected from the newest.
      expect(cleaning.map((item: { date: string }) => item.date)).toEqual(
        [1, 8, 15, 22, 29].map(offset => addDays(today, offset)),
      );
    });

    it('never makes one occurrence twice, however many runs race for it', async () => {
      const rows = await series(seriesId);
      await dataSource.query('DELETE FROM payables WHERE id = $1', [rows[1].id]);
      const made = await Promise.all(
        Array.from({ length: 5 }, () => recurrence().ensureSeries(owner.workspaceId, seriesId)),
      );
      expect(made.reduce((sum, count) => sum + count, 0)).toBe(1);
      expect(await series(seriesId)).toHaveLength(2);
      // The database refuses a second row for the same series and day.
      await expect(
        dataSource.query(
          `INSERT INTO payables (workspace_id, vendor, amount, currency, series_id, occurrence_date)
           VALUES ($1, 'ACME Cleaning', 25, 'KZT', $2, $3)`,
          [owner.workspaceId, seriesId, addDays(today, 8)],
        ),
      ).rejects.toThrow(/UQ_payables_series_occurrence/);
    });

    it('does not make again an occurrence a person deleted', async () => {
      const rows = await series(seriesId);
      await as(owner, request(server()).delete(`/payables/${rows[1].id}`)).expect(200);
      await recurrence().ensureSeries(owner.workspaceId, seriesId);
      const after = await series(seriesId);
      expect(after).toHaveLength(2);
      expect(after[1].deletedAt).not.toBeNull();
    });
  });

  it('extends a series in every workspace that holds its id, not in one of them', async () => {
    // A restored copy of a workspace keeps the series ids of its bills.
    const sharedId = randomUUID();
    const paidOn = addDays(today, -3);
    const rule = { frequency: 'monthly', interval: 1, startDate: paidOn };
    for (const account of [owner, other]) {
      await dataSource.query(
        `INSERT INTO payables (workspace_id, vendor, amount, currency, status, due_date,
                               is_recurring, recurrence, series_id, occurrence_date)
         VALUES ($1, 'ACME Rent', 50, 'KZT', 'paid', $2, true, $3, $4, $2)`,
        [account.workspaceId, paidOn, JSON.stringify(rule), sharedId],
      );
    }
    await recurrence().generateDue();
    const counts = await Promise.all(
      [owner, other].map(account =>
        dataSource
          .getRepository(Payable)
          .count({ where: { workspaceId: account.workspaceId, seriesId: sharedId } }),
      ),
    );
    expect(counts).toEqual([2, 2]);
  });

  it('turns only current old repeating flags into a series, open ones included', async () => {
    const runner = dataSource.createQueryRunner();
    await runner.startTransaction();
    try {
      const insert = async (vendor: string, status: string, due: string): Promise<string> => {
        const rows: Array<{ id: string }> = await runner.query(
          `INSERT INTO payables (workspace_id, vendor, amount, currency, status, due_date, is_recurring)
           VALUES ($1, $2, 10, 'KZT', $3, $4, true) RETURNING id`,
          [owner.workspaceId, vendor, status, due],
        );
        return rows[0].id;
      };
      // Overdue for two years: a monthly rule would make 23 overdue bills on the first run.
      const forgotten = await insert('ACME Old Gym', 'overdue', addDays(today, -700));
      const current = await insert('ACME Internet', 'to_pay', addDays(today, -10));
      await new AddPayableRecurrence1788210000000().up(runner);
      const rows: Array<{ id: string; recurrence: unknown; series_id: string | null }> =
        await runner.query(
          'SELECT id, recurrence, series_id FROM payables WHERE id = ANY($1::uuid[])',
          [[forgotten, current]],
        );
      const byId = new Map(rows.map(row => [row.id, row]));
      expect(byId.get(forgotten)).toMatchObject({ recurrence: null, series_id: null });
      expect(byId.get(current)).toMatchObject({
        recurrence: { frequency: 'monthly', interval: 1, startDate: addDays(today, -10) },
        series_id: current,
      });
    } finally {
      await runner.rollbackTransaction();
      await runner.release();
    }
  });

  it('reminds each bill as many days ahead as it asks', async () => {
    const due = addDays(today, 4);
    const early = await post('/payables', {
      vendor: 'ACME Water',
      amount: 10,
      currency: 'KZT',
      dueDate: due,
      remindDaysBefore: 5,
    }).expect(201);
    const late = await post('/payables', {
      vendor: 'ACME Phone',
      amount: 10,
      currency: 'KZT',
      dueDate: due,
      remindDaysBefore: 2,
    }).expect(201);
    const soon = (await app.get(PayablesService).findDueSoonPayables()).map(row => row.id);
    expect(soon).toContain(early.body.id);
    expect(soon).not.toContain(late.body.id);
  });

  describe('"not this payment" on a bill', () => {
    it('drops a refused row from the payment candidates of that bill only', async () => {
      const bill = await post('/payables', {
        vendor: 'ACME Internet',
        amount: 42,
        currency: 'KZT',
        dueDate: today,
      }).expect(201);
      const twin = await post('/payables', {
        vendor: 'ACME Internet',
        amount: 42,
        currency: 'KZT',
        dueDate: today,
      }).expect(201);
      const rowId = await bankRow('ACME Internet', 42);
      const candidates = async (id: string) =>
        (await as(owner, request(server()).get(`/payables/${id}/payment-candidates`)).expect(200))
          .body as Array<{ id: string }>;
      expect((await candidates(bill.body.id)).map(row => row.id)).toContain(rowId);

      await post(`/payables/${bill.body.id}/match-rejections`, { transactionId: rowId }).expect(201);
      expect((await candidates(bill.body.id)).map(row => row.id)).not.toContain(rowId);
      expect((await candidates(twin.body.id)).map(row => row.id)).toContain(rowId);
      const suggestion = await as(
        owner,
        request(server()).get(`/payables/allocation-suggestion/${rowId}`),
      ).expect(200);
      const suggested = suggestion.body.allocations.map((item: { payableId: string }) => item.payableId);
      expect(suggested).not.toContain(bill.body.id);
      expect(suggested).toContain(twin.body.id);
    });

    it('unlinks a wrong automatic match and never links that row again', async () => {
      const bill = await post('/payables', {
        vendor: 'ACME Insurance',
        amount: 77,
        currency: 'KZT',
        dueDate: today,
      }).expect(201);
      // Marked paid with no wallet or bank row: the money is expected from the bank.
      await post(`/payables/${bill.body.id}/payments`, { amount: 77, paidOn: today }).expect(201);
      const rowId = await bankRow('Someone else', 77);
      const unbooked = app.get(UnbookedPaymentsService);
      expect(await unbooked.linkUnbooked(owner.workspaceId)).toBe(1);

      const res = await post(`/payables/${bill.body.id}/match-rejections`, {
        transactionId: rowId,
      }).expect(201);
      expect(res.body).toMatchObject({ status: 'paid', linkedTransactionId: null });
      const payments = await as(
        owner,
        request(server()).get(`/payables/${bill.body.id}/payments`),
      ).expect(200);
      expect(payments.body.map((payment: { transactionId: string | null }) => payment.transactionId))
        .toEqual([null]);
      expect(await unbooked.linkUnbooked(owner.workspaceId)).toBe(0);
    });

    it('is refused for another workspace', async () => {
      const bill = await post('/payables', {
        vendor: 'ACME Gas',
        amount: 5,
        currency: 'KZT',
        dueDate: today,
      }).expect(201);
      const rowId = await bankRow('ACME Gas', 5);
      await post(`/payables/${bill.body.id}/match-rejections`, { transactionId: rowId }, other)
        .expect(404);
      const otherBill = await post(
        '/payables',
        { vendor: 'ACME Gas', amount: 5, currency: 'KZT', dueDate: today },
        other,
      ).expect(201);
      await post(`/payables/${otherBill.body.id}/match-rejections`, { transactionId: rowId }, other)
        .expect(404);
      const [{ count }] = await dataSource.query(
        'SELECT COUNT(*)::int AS count FROM payable_match_rejections WHERE transaction_id = $1',
        [rowId],
      );
      expect(count).toBe(0);
    });
  });

  describe('"not this payment" on a subscription', () => {
    it('drops the row from that subscription\'s candidates and removes it as a payment', async () => {
      const subscription = await post('/subscriptions', {
        vendorName: 'ACME Stream',
        amount: 9,
        frequency: 'biweekly',
        currency: 'KZT',
        nextChargeDate: addDays(today, 3),
      }).expect(201);
      expect(subscription.body.frequency).toBe('biweekly');
      const id = subscription.body.id;
      const rowId = await bankRow('ACME Stream', 9);
      const candidates = async (query: string) =>
        (
          await as(
            owner,
            request(server()).get(`/subscriptions/charge-candidates?vendorName=ACME%20Stream${query}`),
          ).expect(200)
        ).body.map((row: { transactionId: string }) => row.transactionId);
      expect(await candidates(`&subscriptionId=${id}`)).toContain(rowId);

      await post(`/subscriptions/${id}/charges`, { transactionId: rowId }).expect(201);
      const res = await post(`/subscriptions/${id}/match-rejections`, {
        transactionId: rowId,
      }).expect(201);
      expect(res.body).toEqual({ ok: true });
      const detail = await as(owner, request(server()).get(`/subscriptions/${id}`)).expect(200);
      expect(
        detail.body.charges.map((charge: { transactionId: string | null }) => charge.transactionId),
      ).not.toContain(rowId);
      expect(await candidates(`&subscriptionId=${id}`)).not.toContain(rowId);
      // Refused for this subscription, not for every one.
      expect(await candidates('')).toContain(rowId);
      await post(`/subscriptions/${id}/match-rejections`, { transactionId: rowId }, other).expect(
        404,
      );
    });

    it('leaves a refused row out of the detected charges booked on confirm', async () => {
      const kept = await bankRow('ACME Music', 12, addDays(today, -40));
      const refused = await bankRow('ACME Music', 12, addDays(today, -10));
      const detected = await dataSource.getRepository(Subscription).save({
        workspaceId: owner.workspaceId,
        vendorName: 'ACME Music',
        amount: 12,
        currency: 'KZT',
        frequency: SubscriptionFrequency.MONTHLY,
        status: SubscriptionStatus.DETECTED,
        detectionMeta: { transactionIds: [kept, refused] },
      });
      await post(`/subscriptions/${detected.id}/match-rejections`, {
        transactionId: refused,
      }).expect(201);
      await post(`/subscriptions/${detected.id}/confirm`, {}).expect(201);
      const charges: Array<{ transaction_id: string }> = await dataSource.query(
        'SELECT transaction_id FROM subscription_charges WHERE subscription_id = $1',
        [detected.id],
      );
      expect(charges.map(row => row.transaction_id)).toEqual([kept]);
    });
  });
});
