import type { Repository } from 'typeorm';
import { localDay } from '../../common/recurrence/date-only';
import {
  nextOccurrence,
  nextToMake,
  type RecurrenceRule,
  shiftOffNonWorkingDays,
} from '../../common/recurrence/recurrence';
import { type Payable, PayableDirection } from '../../entities/payable.entity';
import type { SubscriptionFrequency } from '../../entities/subscription.entity';
import { subscriptionStep } from '../subscriptions/charge-calendar.util';
import { daysInMonth } from './dashboard-window.util';

/** Month arithmetic that clamps to the last day instead of overflowing (Jan 31 + 1m = Feb 28). */
function addMonths(date: Date, months: number): Date {
  const dayOfMonth = date.getDate();
  const result = new Date(date.getFullYear(), date.getMonth() + months, 1);
  result.setDate(Math.min(dayOfMonth, daysInMonth(result)));
  return result;
}

function advanceByFrequency(date: Date, frequency: SubscriptionFrequency): Date {
  const step = subscriptionStep(frequency);
  if (step.unit === 'month') return addMonths(date, step.count);
  const next = new Date(date);
  next.setDate(next.getDate() + step.count);
  return next;
}

/** Every charge date of a subscription, from its next charge, that falls inside [today, horizonEnd]. */
export function projectSubscriptionCharges(
  nextCharge: Date | null,
  frequency: SubscriptionFrequency,
  today: Date,
  horizonEnd: Date,
  maxSteps: number,
): Date[] {
  let cursor = nextCharge;
  if (!cursor) {
    return [];
  }

  // A next-charge date left in the past means the charge was never reconciled;
  // roll it forward so the projection starts from the next real occurrence.
  let guard = 0;
  while (cursor < today && guard < maxSteps) {
    cursor = advanceByFrequency(cursor, frequency);
    guard += 1;
  }

  const charges: Date[] = [];
  while (cursor <= horizonEnd && charges.length < maxSteps) {
    charges.push(new Date(cursor));
    cursor = advanceByFrequency(cursor, frequency);
  }
  return charges;
}

/**
 * The newest bill of each repeating series the workspace owes on (or, with a
 * null direction, is owed too), deleted or not: as for the daily job, a series
 * goes on while its newest occurrence holds the rule, and only clearing the
 * rule (on every occurrence) ends it.
 */
export async function newestRecurringPayables(
  payables: Repository<Payable>,
  workspaceId: string,
  direction: PayableDirection | null = PayableDirection.PAYABLE,
): Promise<Payable[]> {
  const rows: Array<{ id: string }> = await payables.query(
    `SELECT newest."id" FROM (
       SELECT DISTINCT ON (p."series_id") p."id", p."recurrence"
         FROM "payables" p
        WHERE p."workspace_id" = $1 AND p."series_id" IS NOT NULL
          AND ($2::text IS NULL OR p."direction"::text = $2)
        ORDER BY p."series_id", p."occurrence_date" DESC
     ) newest
     WHERE newest."recurrence" IS NOT NULL`,
    [workspaceId, direction],
  );
  if (rows.length === 0) return [];
  return payables
    .createQueryBuilder('payable')
    .withDeleted()
    .where('payable.workspaceId = :workspaceId', { workspaceId })
    .andWhere('payable.id IN (:...ids)', { ids: rows.map(row => row.id) })
    .getMany();
}

/**

 * The occurrences of a series not made yet, inside [today, horizonEnd]: the
 * dates the job will make (`nextToMake`), at the series amount, moved off
 * weekends as the rule says (public holidays are not looked up here; the bill
 * made later is). The one an upgraded series missed is owed already, so it
 * lands on today, overdue, like any overdue bill. `occurrenceDate` is the day
 * the rule gives, before the move.
 */
export function projectedOccurrences(
  newest: Payable,
  today: Date,
  horizonEnd: Date,
): Array<{ date: string; occurrenceDate: string; amount: number; isOverdue: boolean }> {
  const rule = newest.recurrence as RecurrenceRule | null;
  if (!(rule && newest.occurrenceDate)) return [];
  const from = localDay(today);
  const to = localDay(horizonEnd);
  const amount = Number(newest.baseAmount ?? newest.amount);
  const items: Array<{ date: string; occurrenceDate: string; amount: number; isOverdue: boolean }> =
    [];
  const after = String(newest.occurrenceDate).slice(0, 10);
  let day = nextToMake(rule, after, from, newest.catchUpOnce);
  while (day) {
    const due = shiftOffNonWorkingDays(day, rule.shift);
    if (due > to) break;
    items.push({ date: due < from ? from : due, occurrenceDate: day, amount, isOverdue: due < from });
    day = nextOccurrence(rule, day);
  }
  return items;
}
