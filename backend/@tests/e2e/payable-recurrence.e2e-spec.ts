import { SubscriptionsService } from '../../src/modules/subscriptions/subscriptions.service';
vi.mock('franc', () => ({
  franc: () => 'und',
}));

import { randomUUID } from 'node:crypto';
import { type INestApplication, ValidationPipe } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { addDays, formatDay, weekdayOf } from '../../src/common/recurrence/date-only';
import {
  nextOccurrence,
  nextToMake,
  occurrencesFrom,
  type RecurrenceRule,
} from '../../src/common/recurrence/recurrence';
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

    it('deletes only that payment: the series goes on, and the deleted day is never made again', async () => {
      const rows = await series(seriesId);
      await as(owner, request(server()).delete(`/payables/${rows[1].id}`)).expect(200);
      const after = await series(seriesId);
      expect(after.map(row => String(row.occurrenceDate))).toEqual(
        [1, 8, 15].map(offset => addDays(today, offset)),
      );
      expect(after[1].deletedAt).not.toBeNull();
      await recurrence().ensureSeries(owner.workspaceId, seriesId);
      await recurrence().generateDue();
      expect(await series(seriesId)).toHaveLength(3);
      // The unique index holds the deleted row's day too: not even a direct write makes it again.
      await expect(
        dataSource.query(
          `INSERT INTO payables (workspace_id, vendor, amount, currency, series_id, occurrence_date)
           VALUES ($1, 'ACME Cleaning', 25, 'KZT', $2, $3)`,
          [owner.workspaceId, seriesId, addDays(today, 8)],
        ),
      ).rejects.toThrow(/UQ_payables_series_occurrence/);
    });

    it('archives only that payment and makes the next occurrence at once', async () => {
      const newest = (await series(seriesId)).at(-1) as Payable;
      await put(`/payables/${newest.id}/archive`, {}).expect(200);
      const after = await series(seriesId);
      expect(after.map(row => String(row.occurrenceDate)).at(-1)).toBe(addDays(today, 22));
    });

    it('stops repeating from any occurrence, for the job and for a restored backup alike', async () => {
      const [first] = await series(seriesId);
      await put(`/payables/${first.id}/occurrence`, { action: 'stop' }, other).expect(404);
      const res = await put(`/payables/${first.id}/occurrence`, { action: 'stop' }).expect(200);
      expect(res.body).toMatchObject({ recurrence: null, isRecurring: false, seriesId });
      // Withdrawing the newest would make the next one of a live series at once.
      await put(`/payables/${(await series(seriesId)).at(-1)?.id}/archive`, {}).expect(200);
      const rows = await series(seriesId);
      expect(rows.map(row => row.recurrence)).toEqual(rows.map(() => null));
      await recurrence().generateDue();
      await recurrence().ensureSeries(owner.workspaceId, seriesId);
      expect(await series(seriesId)).toHaveLength(rows.length);
      // A backup carries the live rows only: without the deleted one it stays stopped.
      await dataSource.query(
        'DELETE FROM payables WHERE series_id = $1 AND deleted_at IS NOT NULL',
        [seriesId],
      );
      await recurrence().ensureSeries(owner.workspaceId, seriesId);
      expect(await series(seriesId)).toHaveLength(rows.length - 1);
      // Stopping again answers the same bill.
      await put(`/payables/${first.id}/occurrence`, { action: 'stop' }).expect(200);
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

  /** A series written straight to the table: one occurrence of `rule` on `day`. */
  async function seriesRow(
    vendor: string,
    rule: Record<string, unknown>,
    day: string,
    columns: {
      status?: string;
      dueDate?: string;
      remindDaysBefore?: number;
      catchUpOnce?: boolean;
    } = {},
  ): Promise<string> {
    const id = randomUUID();
    await dataSource.query(
      `INSERT INTO payables (id, workspace_id, vendor, amount, currency, status, due_date,
                             is_recurring, recurrence, series_id, occurrence_date, remind_days_before,
                             catch_up_once)
       VALUES ($1, $2, $3, 20, 'KZT', $4, $5, true, $6, $1, $7, $8, $9)`,
      [
        id,
        owner.workspaceId,
        vendor,
        columns.status ?? 'to_pay',
        columns.dueDate ?? day,
        JSON.stringify(rule),
        day,
        columns.remindDaysBefore ?? 3,
        columns.catchUpOnce ?? false,
      ],
    );
    return id;
  }

  /** `count` occurrences of one series a week apart from `start`, written straight to the table. */
  async function weeklyRows(vendor: string, start: string, count: number): Promise<string[]> {
    const seriesId = randomUUID();
    const rule = JSON.stringify({ frequency: 'weekly', interval: 1, startDate: start });
    const ids: string[] = [];
    for (let index = 0; index < count; index += 1) {
      const day = addDays(start, 7 * index);
      const [{ id }]: Array<{ id: string }> = await dataSource.query(
        `INSERT INTO payables (workspace_id, vendor, amount, currency, status, due_date,
                               is_recurring, recurrence, series_id, occurrence_date)
         VALUES ($1, $2, 20, 'KZT', 'to_pay', $3, true, $4, $5, $3) RETURNING id`,
        [owner.workspaceId, vendor, day, rule, seriesId],
      );
      ids.push(id);
    }
    return ids;
  }

  /** Runs `during` while a run has read the series' rule and not yet written the next occurrence. */
  async function duringExtension(seriesId: string, during: () => void): Promise<void> {
    const service = recurrence() as unknown as { holidaysFor: () => Promise<Set<string>> };
    const holidays = vi.spyOn(service, 'holidaysFor').mockImplementationOnce(async () => {
      during();
      await new Promise(resolve => setTimeout(resolve, 500));
      return new Set<string>();
    });
    try {
      await recurrence().ensureSeries(owner.workspaceId, seriesId);
    } finally {
      holidays.mockRestore();
    }
  }

  describe('writers of one series', () => {
    it('serves two stops on two occurrences of one series one after the other', async () => {
      const ids = await weeklyRows('ACME Shredding', addDays(today, 30), 4);
      const real = recurrence().stopSeries.bind(recurrence());
      const stop = vi.spyOn(recurrence(), 'stopSeries').mockImplementation(async (...args) => {
        await new Promise(resolve => setTimeout(resolve, 300));
        return real(...args);
      });
      try {
        const answers = await Promise.all(
          [ids[0], ids[3]].map(id => put(`/payables/${id}/occurrence`, { action: 'stop' })),
        );
        expect(answers.map(answer => answer.status)).toEqual([200, 200]);
      } finally {
        stop.mockRestore();
      }
      const rows = await dataSource.query('SELECT recurrence FROM payables WHERE id = ANY($1)', [ids]);
      expect(rows.map((row: { recurrence: unknown }) => row.recurrence)).toEqual(ids.map(() => null));
    });

    it('stops an earlier occurrence while a run makes the next one, and the new one stops too', async () => {
      const start = addDays(today, -33);
      const rule = { frequency: 'monthly', interval: 1, startDate: start };
      const id = await seriesRow('ACME Pest Control', rule, start, { status: 'paid' });
      await dataSource.query(
        `INSERT INTO payables (workspace_id, vendor, amount, currency, status, due_date,
                               is_recurring, recurrence, series_id, occurrence_date)
         VALUES ($1, 'ACME Pest Control', 20, 'KZT', 'paid', $2, true, $3, $4, $2)`,
        [owner.workspaceId, nextOccurrence(rule as RecurrenceRule, start), JSON.stringify(rule), id],
      );
      let stopping: Promise<request.Response> | null = null;
      await duringExtension(id, () => {
        stopping = put(`/payables/${id}/occurrence`, { action: 'stop' }).then(answer => answer);
      });
      expect(((await stopping) as unknown as request.Response).status).toBe(200);
      const rows = await series(id);
      expect(rows).toHaveLength(3);
      expect(rows.map(row => row.recurrence)).toEqual([null, null, null]);
    });

    it('gives the occurrence a run is making the rule an edit sets meanwhile', async () => {
      const start = addDays(today, -3);
      const rule = { frequency: 'monthly', interval: 1, startDate: start };
      const id = await seriesRow('ACME Window Repair', rule, start, { status: 'paid' });
      const weekly = { frequency: 'weekly', interval: 1, startDate: start };
      let editing: Promise<request.Response> | null = null;
      await duringExtension(id, () => {
        editing = put(`/payables/${id}`, { recurrence: weekly }).then(answer => answer);
      });
      expect(((await editing) as unknown as request.Response).status).toBe(200);
      const newest = (await series(id)).at(-1) as Payable;
      expect(newest.id).not.toBe(id);
      expect(newest.recurrence).toMatchObject({ frequency: 'weekly' });
    });

    it('carries a rule change to a deleted later occurrence too', async () => {
      const ids = await weeklyRows('ACME Bins', addDays(today, 40), 2);
      await dataSource.query('UPDATE payables SET deleted_at = now() WHERE id = $1', [ids[1]]);
      const monthly = { frequency: 'monthly', interval: 1, startDate: addDays(today, 40) };
      await put(`/payables/${ids[0]}`, { recurrence: monthly }).expect(200);
      const [later] = await dataSource.query('SELECT recurrence FROM payables WHERE id = $1', [ids[1]]);
      expect(later.recurrence).toMatchObject({ frequency: 'monthly' });
    });

    it('goes on in the daily job when every occurrence is deleted and the rule is held', async () => {
      const start = addDays(today, -2);
      const rule = { frequency: 'monthly', interval: 1, startDate: start };
      const id = await seriesRow('ACME Snow Removal', rule, start);
      await dataSource.query('UPDATE payables SET deleted_at = now() WHERE id = $1', [id]);
      await recurrence().generateDue();
      const rows = await series(id);
      expect(rows.map(row => String(row.occurrenceDate))).toEqual([
        start,
        nextOccurrence(rule as RecurrenceRule, start),
      ]);
      expect(rows[1].deletedAt).toBeNull();
    });
  });

  it('marks a caught-up bill overdue only when its due day, after the shift, has passed', async () => {
    // 15 November 2026 is a Sunday: moved to the next working day, it is due on the run's own day.
    expect(weekdayOf('2026-11-15')).toBe(0);
    const rule = { frequency: 'monthly', interval: 1, startDate: '2026-10-15', shift: 'next' };
    const id = await seriesRow('ACME Car Park', rule, '2026-10-15', {
      status: 'paid',
      catchUpOnce: true,
    });
    await recurrence().ensureSeries(owner.workspaceId, id, '2026-11-16');
    const [, caught] = await series(id);
    expect(caught).toMatchObject({ occurrenceDate: '2026-11-15', status: 'to_pay' });
    expect(String(caught.dueDate)).toBe('2026-11-16');
  });

  describe('how a series ends', () => {
    it('ends the whole series when one occurrence is set to "does not repeat", deleted or not', async () => {
      const start = addDays(today, -6);
      const rule = { frequency: 'monthly', interval: 1, startDate: start };
      const id = await seriesRow('ACME Courier', rule, start, { status: 'paid' });
      await recurrence().ensureSeries(owner.workspaceId, id);
      const [, later] = await series(id);
      await put(`/payables/${later.id}`, { recurrence: null }).expect(200);
      expect((await series(id)).map(row => row.recurrence)).toEqual([null, null]);
      // Deleting the one that ended it does not bring the series back.
      await as(owner, request(server()).delete(`/payables/${later.id}`)).expect(200);
      await recurrence().generateDue();
      await recurrence().ensureSeries(owner.workspaceId, id);
      expect(await series(id)).toHaveLength(2);
    });

    it('stops a run making the next occurrence when the stop lands in between', async () => {
      const start = addDays(today, -3);
      const rule = { frequency: 'monthly', interval: 1, startDate: start };
      const id = await seriesRow('ACME Archive Boxes', rule, start, { status: 'paid' });
      // The stop comes while the run has read the rule and not yet written the occurrence.
      let stopping: Promise<request.Response> | null = null;
      const service = recurrence() as unknown as { holidaysFor: () => Promise<Set<string>> };
      const holidays = vi.spyOn(service, 'holidaysFor').mockImplementationOnce(async () => {
        stopping = put(`/payables/${id}/occurrence`, { action: 'stop' }).then(answer => answer);
        await new Promise(resolve => setTimeout(resolve, 500));
        return new Set<string>();
      });
      try {
        await recurrence().ensureSeries(owner.workspaceId, id);
        expect(((await stopping) as unknown as request.Response).status).toBe(200);
      } finally {
        holidays.mockRestore();
      }
      const rows = await series(id);
      expect(rows.map(row => row.recurrence)).toEqual(rows.map(() => null));
      expect(await recurrence().ensureSeries(owner.workspaceId, id)).toBe(0);
    });
  });

  it('gives a series made by the upgrade the one bill it missed, without an overdue notice', async () => {
    // Monthly, last bill 40 days ago: the date a month after it has passed and is owed.
    const last = addDays(today, -40);
    const rule = { frequency: 'monthly', interval: 1, startDate: last };
    const id = await seriesRow('ACME Gym Club', rule, last, { catchUpOnce: true });
    await recurrence().generateDue();
    const missed = nextToMake(rule as RecurrenceRule, last, today, true) as string;
    expect(missed < today).toBe(true);
    const rows = await series(id);
    expect(rows.map(row => String(row.occurrenceDate))).toEqual([last, missed]);
    expect(rows[1]).toMatchObject({ status: 'overdue', catchUpOnce: false });
    const noticed = (await app.get(PayablesService).markOverduePayables()).map(row => row.id);
    expect(noticed).not.toContain(rows[1].id);
    // Once only: from it on, nothing before today.
    await recurrence().generateDue();
    expect(await series(id)).toHaveLength(2);
  });

  describe('no catch-up', () => {
    const days = async (seriesId: string) =>
      (await series(seriesId)).map(row => String(row.occurrenceDate));

    it('makes only the next date on or after today for a series left alone for months', async () => {
      const start = addDays(today, -100);
      const rule = { frequency: 'monthly', interval: 1, startDate: start };
      const id = await seriesRow('ACME Gym', rule, start, { status: 'paid' });
      await recurrence().generateDue();
      const next = occurrencesFrom(rule as RecurrenceRule, today).next().value as string;
      expect(await days(id)).toEqual([start, next]);
    });

    it('counts the passed-over dates towards the number of occurrences', async () => {
      const start = addDays(today, -100);
      // Three in all: the 2nd and 3rd fell while nobody looked, so the series is over.
      const rule = { frequency: 'monthly', interval: 1, startDate: start, count: 3 };
      const id = await seriesRow('ACME Lessons', rule, start, { status: 'paid' });
      expect(await recurrence().ensureSeries(owner.workspaceId, id)).toBe(0);
      expect(await days(id)).toEqual([start]);
    });

    it('keeps the past due date a bill was created with and goes on from today', async () => {
      const start = addDays(today, -20);
      const res = await post('/payables', {
        vendor: 'ACME Laundry',
        amount: 15,
        currency: 'KZT',
        recurrence: { frequency: 'weekly', interval: 1, startDate: start },
      }).expect(201);
      expect(res.body.dueDate).toBe(start);
      expect(await days(res.body.seriesId)).toEqual([start, addDays(today, 1), addDays(today, 8)]);
    });
  });

  it('makes the next occurrence by the day it is due, so a long reminder after a shift is on time', async () => {
    // A Sunday three weeks after the run, moved back to its Friday: due 19 days after the run.
    let sunday = addDays(today, 30);
    while (weekdayOf(sunday) !== 0) sunday = addDays(sunday, 1);
    const runDay = addDays(sunday, -21);
    const rule = {
      frequency: 'weekly',
      interval: 1,
      startDate: addDays(sunday, -7),
      shift: 'previous',
    };
    const id = await seriesRow('ACME Storage', rule, addDays(sunday, -7), {
      dueDate: addDays(sunday, -9),
      remindDaysBefore: 20,
    });
    expect(await recurrence().ensureSeries(owner.workspaceId, id, runDay)).toBe(1);
    const [, next] = await series(id);
    expect(String(next.occurrenceDate)).toBe(sunday);
    expect(String(next.dueDate) <= addDays(sunday, -2)).toBe(true);
  });

  it('refuses a repeat rule on a day that does not exist', async () => {
    const body = (rule: Record<string, unknown>) => ({
      vendor: 'ACME Calendar',
      amount: 5,
      currency: 'KZT',
      recurrence: { frequency: 'monthly', interval: 1, ...rule },
    });
    await post('/payables', body({ startDate: '2026-13-01' })).expect(400);
    await post('/payables', body({ startDate: '2027-02-30' })).expect(400);
    await post('/payables', body({ startDate: '2027-01-30', until: '2027-02-30' })).expect(400);
    const [{ count }] = await dataSource.query(
      `SELECT COUNT(*)::int AS count FROM payables WHERE vendor = 'ACME Calendar'`,
    );
    expect(count).toBe(0);
  });

  it('carries an amount typed into the bill form to the next occurrence, over a one-off one', async () => {
    const start = addDays(today, 20);
    const res = await post('/payables', {
      vendor: 'ACME Heating',
      amount: 100,
      currency: 'KZT',
      recurrence: { frequency: 'monthly', interval: 1, startDate: start },
    }).expect(201);
    const id = res.body.id;
    await put(`/payables/${id}/occurrence`, { action: 'amount', amount: 140 }).expect(200);
    // The form sends the amount it shows: unchanged, the one-off amount stays one-off.
    const same = await put(`/payables/${id}`, { amount: 140, comment: 'Winter' }).expect(200);
    expect(same.body).toMatchObject({ amount: '140.00', baseAmount: '100.00' });
    const typed = await put(`/payables/${id}`, { amount: 160 }).expect(200);
    expect(typed.body).toMatchObject({ amount: '160.00', baseAmount: null });
    await put(`/payables/${id}/mark-paid`, { inHand: true }).expect(200);
    const rows = await waitForCount(id, 2);
    expect(Number(rows[1].amount)).toBe(160);
  });

  it('waits for a payment in progress, then refuses to skip the occurrence it paid', async () => {
    const res = await post('/payables', {
      vendor: 'ACME Alarm',
      amount: 30,
      currency: 'KZT',
      recurrence: { frequency: 'monthly', interval: 1, startDate: addDays(today, 20) },
    }).expect(201);
    const id = res.body.id;
    // A payment holding the bill, as mark-paid does, while the skip comes in.
    const payment = dataSource.createQueryRunner();
    await payment.connect();
    await payment.startTransaction();
    await payment.query('SELECT id FROM payables WHERE id = $1 FOR UPDATE', [id]);
    const skipping = put(`/payables/${id}/occurrence`, { action: 'skip' }).then(answer => answer);
    await new Promise(resolve => setTimeout(resolve, 500));
    await payment.query(
      `UPDATE payables SET status = 'paid', paid_amount = amount, paid_at = now() WHERE id = $1`,
      [id],
    );
    await payment.commitTransaction();
    await payment.release();
    expect((await skipping).status).toBe(409);
    const [row] = await series(id);
    expect(row).toMatchObject({ status: 'paid', skippedAt: null });
  });

  it('turns only current old repeating flags into a series, its step read off the gaps', async () => {
    const runner = dataSource.createQueryRunner();
    await runner.startTransaction();
    try {
      const insert = async (
        vendor: string,
        status: string,
        offset: number,
        { deleted = false, flagged = true } = {},
      ): Promise<string> => {
        const rows: Array<{ id: string }> = await runner.query(
          `INSERT INTO payables (workspace_id, vendor, amount, currency, status, due_date,
                                 is_recurring, deleted_at)
           VALUES ($1, $2, 10, 'KZT', $3, $4, $5, CASE WHEN $6 THEN now() END) RETURNING id`,
          [owner.workspaceId, vendor, status, addDays(today, offset), flagged, deleted],
        );
        return rows[0].id;
      };
      /** Earlier paid copies `gap` days apart, then the newest open one 3 days ago. */
      const history = async (vendor: string, gap: number): Promise<string> => {
        await insert(vendor, 'paid', -3 - 2 * gap);
        await insert(vendor, 'paid', -3 - gap);
        return insert(vendor, 'to_pay', -3);
      };
      // Overdue for two years: a monthly rule would make 23 overdue bills on the first run.
      const forgotten = await insert('ACME Old Gym', 'overdue', -700);
      const single = await insert('ACME Fibre', 'to_pay', -10);
      const weekly = await history('ACME Window Cleaning', 7);
      const fortnightly = await history('ACME Garden', 14);
      const monthly = await history('ACME Phone Plan', 31);
      const quarterly = await history('ACME Water Board', 91);
      const halfYearly = await history('ACME Car Service', 182);
      const yearly = await history('ACME Domain', 365);
      const odd = await history('ACME Odd Jobs', 50);
      // A deleted copy does not count for the gaps: 14, not 7 and 7.
      await insert('ACME Dog Walk', 'paid', -17);
      await insert('ACME Dog Walk', 'paid', -10, { deleted: true });
      const walked = await insert('ACME Dog Walk', 'to_pay', -3);
      // Copies a day apart are duplicates, not a daily bill: 5 and 7 days, weekly.
      for (const offset of [-17, -16, -15, -10]) await insert('ACME Pool Service', 'paid', offset);
      const pool = await insert('ACME Pool Service', 'to_pay', -3);
      const priced = async (vendor: string, amount: number, offset: number, status = 'paid') =>
        (
          await runner.query(
            `INSERT INTO payables (workspace_id, vendor, amount, currency, status, due_date, is_recurring)
             VALUES ($1, $2, $3, 'KZT', $4, $5, true) RETURNING id`,
            [owner.workspaceId, vendor, amount, status, addDays(today, offset)],
          )
        )[0].id as string;
      // One bank, two bills: a 120 card on one day and a 500 loan two weeks off it.
      const bank = (amount: number, offset: number, status = 'paid') =>
        priced('ACME Bank', amount, offset, status);
      // Monthly, its amount different each time: 15.00 coming back once is no quarterly bill.
      await priced('ACME Electricity', 15, -93);
      await priced('ACME Electricity', 18.2, -63);
      await priced('ACME Electricity', 16.7, -33);
      const electricity = await priced('ACME Electricity', 15, -3, 'to_pay');
      for (const offset of [-93, -63, -33]) await bank(120, offset);
      for (const offset of [-77, -47]) await bank(500, offset);
      const loan = await bank(500, -17, 'to_pay');
      const card = await bank(120, -3, 'to_pay');
      // A copy deleted two days after the live one is a duplicate removed by hand.
      const gas = await insert('ACME Gas', 'to_pay', -5);
      const gasCopy = await insert('ACME Gas', 'to_pay', -3, { deleted: true });
      // Withdrawn, dropped, or already followed by a bill entered by hand: left as they are.
      const archivedOld = await insert('ACME Archived', 'paid', -35);
      const archived = await insert('ACME Archived', 'archived', -5);
      const droppedOld = await insert('ACME Dropped', 'to_pay', -35);
      const dropped = await insert('ACME Dropped', 'to_pay', -5, { deleted: true });
      const followed = await insert('ACME Followed', 'to_pay', -10);
      const byHand = await insert('ACME Followed', 'to_pay', 20, { flagged: false });

      const migration = new AddPayableRecurrence1788210000000();
      await migration.up(runner);
      type Converted = { recurrence: unknown; series_id: string | null; catch_up_once: boolean };
      const read = async (): Promise<Map<string, Converted>> => {
        const rows: Array<Converted & { id: string }> = await runner.query(
          `SELECT id, recurrence, series_id, catch_up_once FROM payables
            WHERE workspace_id = $1 AND vendor LIKE 'ACME %'`,
          [owner.workspaceId],
        );
        return new Map(rows.map(({ id, ...row }) => [id, row]));
      };
      const byId = await read();
      const rule = (frequency: string, interval: number, offset: number) => ({
        recurrence: { frequency, interval, startDate: addDays(today, offset) },
      });
      // Its first extension may make the one bill missed since it.
      expect(byId.get(single)).toMatchObject({
        ...rule('monthly', 1, -10),
        series_id: single,
        catch_up_once: true,
      });
      expect(byId.get(weekly)).toMatchObject({ ...rule('weekly', 1, -3), series_id: weekly });
      expect(byId.get(fortnightly)).toMatchObject(rule('weekly', 2, -3));
      expect(byId.get(monthly)).toMatchObject(rule('monthly', 1, -3));
      expect(byId.get(quarterly)).toMatchObject(rule('monthly', 3, -3));
      expect(byId.get(halfYearly)).toMatchObject(rule('monthly', 6, -3));
      expect(byId.get(yearly)).toMatchObject(rule('yearly', 1, -3));
      expect(byId.get(odd)).toMatchObject(rule('monthly', 1, -3));
      expect(byId.get(walked)).toMatchObject(rule('weekly', 2, -3));
      expect(byId.get(pool)).toMatchObject(rule('weekly', 1, -3));
      expect(byId.get(card)).toMatchObject({ ...rule('monthly', 1, -3), series_id: card });
      expect(byId.get(electricity)).toMatchObject(rule('monthly', 1, -3));
      expect(byId.get(gas)).toMatchObject({ ...rule('monthly', 1, -5), series_id: gas });
      const left = [forgotten, archivedOld, archived, droppedOld, dropped, followed, byHand];
      for (const id of [...left, loan, gasCopy]) {
        expect(byId.get(id)).toMatchObject({ recurrence: null, series_id: null });
      }

      // A second run changes nothing.
      await migration.up(runner);
      expect(await read()).toEqual(byId);
    } finally {
      await runner.rollbackTransaction();
      await runner.release();
    }
  });

  it('marks the payment a bill recorded itself, earlier ones included, but no row matched later', async () => {
    const runner = dataSource.createQueryRunner();
    await runner.startTransaction();
    try {
      const bill = async (vendor: string) =>
        (await post('/payables', { vendor, amount: 12, currency: 'KZT', dueDate: today }).expect(201))
          .body.id as string;
      const cash = await bill('ACME Locksmith');
      await put(`/payables/${cash}/mark-paid`, { inHand: true }).expect(200);
      // Rows already in the books, matched to a bill afterwards: a bank row, then two shaped
      // like the cash payment (no statement, the vendor as payee and purpose), a receipt
      // scan's and one typed by hand.
      const matched: string[] = [];
      for (const [vendor, payee] of [
        ['ACME Plumber', 'ACME Plumber Ltd'],
        ['ACME Bookshop', 'ACME Bookshop'],
        ['ACME Florist', 'ACME Florist'],
      ]) {
        const id = await bill(vendor);
        const rowId = await bankRow(payee, 12);
        await put(`/payables/${id}/mark-paid`, { linkedTransactionId: rowId }).expect(200);
        matched.push(id);
      }
      const ids = [cash, ...matched];
      // As before the upgrade: no payment marked.
      await runner.query(
        'UPDATE payable_payments SET own_transaction = false WHERE payable_id = ANY($1::uuid[])',
        [ids],
      );
      await new AddPayableRecurrence1788210000000().up(runner);
      const rows: Array<{ payable_id: string; own_transaction: boolean }> = await runner.query(
        'SELECT payable_id, own_transaction FROM payable_payments WHERE payable_id = ANY($1::uuid[])',
        [ids],
      );
      expect(new Map(rows.map(row => [row.payable_id, row.own_transaction]))).toEqual(
        new Map(ids.map(id => [id, id === cash])),
      );
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

    it("is refused for the bill's own cash payment, which stays as it is", async () => {
      const bill = await post('/payables', {
        vendor: 'ACME Bakery',
        amount: 8,
        currency: 'KZT',
        dueDate: today,
      }).expect(201);
      const paid = await put(`/payables/${bill.body.id}/mark-paid`, { inHand: true }).expect(200);
      const cashId = paid.body.linkedTransactionId as string;
      expect(cashId).toEqual(expect.any(String));
      const refused = await post(`/payables/${bill.body.id}/match-rejections`, {
        transactionId: cashId,
      }).expect(409);
      // Removing the payment would keep the transaction: the answer does not send anyone there.
      expect(refused.body.error).toMatchObject({
        code: 'PAYABLE_REJECT_OWN_PAYMENT',
        message: 'This transaction is the payment recorded with this bill; it cannot be refused here',
      });
      const after = await as(owner, request(server()).get(`/payables/${bill.body.id}`)).expect(200);
      expect(after.body).toMatchObject({ status: 'paid', linkedTransactionId: cashId });
      const payments = await as(
        owner,
        request(server()).get(`/payables/${bill.body.id}/payments`),
      ).expect(200);
      expect(payments.body.map((payment: { transactionId: string }) => payment.transactionId)).toEqual([
        cashId,
      ]);
      const [{ count }] = await dataSource.query(
        'SELECT COUNT(*)::int AS count FROM payable_match_rejections WHERE transaction_id = $1',
        [cashId],
      );
      expect(count).toBe(0);
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
    it('advances a charge on the 31st through February and back to the 31st (#596)', async () => {
      const created = await post('/subscriptions', {
        vendorName: 'ACME Gym',
        amount: 30,
        frequency: 'monthly',
        currency: 'KZT',
        nextChargeDate: '2026-01-31',
      }).expect(201);
      const stored = async () =>
        (
          await dataSource.query(
            'SELECT next_charge_date::text AS next, billing_day AS day FROM subscriptions WHERE id = $1',
            [created.body.id],
          )
        )[0];
      expect(await stored()).toEqual({ next: '2026-01-31', day: 31 });

      const advance = () => app.get(SubscriptionsService).updatePastDueNextDates();
      await advance();
      expect(await stored()).toEqual({ next: '2026-02-28', day: 31 });
      await advance();
      expect(await stored()).toEqual({ next: '2026-03-31', day: 31 });

      // A person moving it to another day moves the billing day too.
      await as(owner, request(server()).put(`/subscriptions/${created.body.id}`))
        .send({ nextChargeDate: '2027-04-15' })
        .expect(200);
      expect(await stored()).toEqual({ next: '2027-04-15', day: 15 });
    });

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
