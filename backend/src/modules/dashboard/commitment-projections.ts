import type { Repository } from 'typeorm';
import { localDay } from '../../common/recurrence/date-only';
import {
  occurrencesFrom,
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

/** The newest bill of each live repeating series the workspace owes on. */
export async function newestRecurringPayables(
  payables: Repository<Payable>,
  workspaceId: string,
): Promise<Payable[]> {
  const rows: Array<{ id: string }> = await payables.query(
    `SELECT newest."id" FROM (
       SELECT DISTINCT ON (p."series_id") p."id", p."deleted_at", p."recurrence"
         FROM "payables" p
        WHERE p."workspace_id" = $1 AND p."series_id" IS NOT NULL AND p."direction" = $2
        ORDER BY p."series_id", p."occurrence_date" DESC
     ) newest
     WHERE newest."deleted_at" IS NULL AND newest."recurrence" IS NOT NULL`,
    [workspaceId, PayableDirection.PAYABLE],
  );
  if (rows.length === 0) return [];
  return payables
    .createQueryBuilder('payable')
    .where('payable.workspaceId = :workspaceId', { workspaceId })
    .andWhere('payable.id IN (:...ids)', { ids: rows.map(row => row.id) })
    .getMany();
}

/**
 * The occurrences of a series not made yet, inside [today, horizonEnd]: after
 * the newest bill's own day, at the series amount, moved off weekends as the
 * rule says (public holidays are not looked up here; the bill made later is).
 */
export function projectedOccurrences(
  newest: Payable,
  today: Date,
  horizonEnd: Date,
): Array<{ date: string; amount: number }> {
  const rule = newest.recurrence as RecurrenceRule | null;
  if (!(rule && newest.occurrenceDate)) return [];
  const from = localDay(today);
  const to = localDay(horizonEnd);
  const amount = Number(newest.baseAmount ?? newest.amount);
  const items: Array<{ date: string; amount: number }> = [];
  for (const day of occurrencesFrom(rule, String(newest.occurrenceDate).slice(0, 10))) {
    if (day <= String(newest.occurrenceDate).slice(0, 10)) continue;
    const due = shiftOffNonWorkingDays(day, rule.shift);
    if (due > to) break;
    if (due >= from) items.push({ date: due, amount });
  }
  return items;
}
