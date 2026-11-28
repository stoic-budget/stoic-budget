import { In, MoreThanOrEqual, type Repository } from 'typeorm';
import { addMonthsClamped, localDay } from '../../common/recurrence/date-only';
import {
  nextOccurrence,
  nextToMake,
  type RecurrenceRule,
  shiftOffNonWorkingDays,
} from '../../common/recurrence/recurrence';
import type { DashboardCommitmentItem } from '../../contracts';
import { type Payable, PayableDirection } from '../../entities/payable.entity';
import type { Subscription, SubscriptionFrequency } from '../../entities/subscription.entity';
import type { SubscriptionCharge } from '../../entities/subscription-charge.entity';
import { chargeAt, paidAheadDays, subscriptionStep } from '../subscriptions/charge-calendar.util';

/** Every charge date of a subscription, from its next charge, that falls inside [today, horizonEnd]. */
export function projectSubscriptionCharges(
  nextCharge: Date | null,
  frequency: SubscriptionFrequency,
  today: Date,
  horizonEnd: Date,
  maxSteps: number,
): Date[] {
  if (!nextCharge) {
    return [];
  }
  // Each charge is counted from the next-charge date, not stepped from the one
  // before: stepping from 31 Jan through 28 Feb would leave every later charge
  // on the 28th. A date left in the past rolls forward to the next real one.
  const charges: Date[] = [];
  for (
    let index = firstIndexFrom(nextCharge, frequency, today);
    charges.length < maxSteps;
    index += 1
  ) {
    const charge = chargeAt(nextCharge, frequency, index);
    if (charge > horizonEnd) break;
    if (charge >= today) charges.push(charge);
  }
  return charges;
}

/** The index of the first charge on or after `today`, however far back the anchor is. */
function firstIndexFrom(anchor: Date, frequency: SubscriptionFrequency, today: Date): number {
  if (anchor >= today) return 0;
  const step = subscriptionStep(frequency);
  const behind =
    step.unit === 'day'
      ? Math.floor((today.getTime() - anchor.getTime()) / (86_400_000 * step.count))
      : Math.floor(
          ((today.getFullYear() - anchor.getFullYear()) * 12 +
            today.getMonth() -
            anchor.getMonth()) /
            step.count,
        );
  // One step short of it at most: the loop above skips what is still before today.
  return Math.max(0, behind - 1);
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
    items.push({
      date: due < from ? from : due,
      occurrenceDate: day,
      amount,
      isOverdue: due < from,
    });
    day = nextOccurrence(rule, day);
  }
  return items;
}

/**
 * Every charge each active subscription will raise inside the window, less
 * the ones already paid ahead: such a payment has left the account and the
 * next charge date stays put, so projecting it takes the money twice (#601).
 * Paid ahead by the rule the budget reserve uses (`paidAheadDays`).
 */
export async function subscriptionCommitments(input: {
  charges: Repository<SubscriptionCharge>;
  workspaceId: string;
  subscriptions: Subscription[];
  window: { today: Date; horizonEnd: Date; maxSteps: number };
  nextChargeOf: (subscription: Subscription) => Date | null;
  amountOf: (subscription: Subscription) => Promise<number>;
}): Promise<DashboardCommitmentItem[]> {
  const { subscriptions, window } = input;
  if (subscriptions.length === 0) return [];
  const paid = paidAheadDays(
    await input.charges.find({
      where: {
        workspaceId: input.workspaceId,
        subscriptionId: In(subscriptions.map(subscription => subscription.id)),
        // 19 months back: the charge before a coming one is among them, an annual one paid early too.
        chargeDate: MoreThanOrEqual(
          addMonthsClamped(localDay(window.today), -19) as unknown as Date,
        ),
      },
      select: { subscriptionId: true, expectedDate: true, chargeDate: true },
    }),
    subscriptions,
    localDay(window.today),
  );
  const items: DashboardCommitmentItem[] = [];
  for (const subscription of subscriptions) {
    const amount = await input.amountOf(subscription);
    if (amount === 0) continue;
    const charges = projectSubscriptionCharges(
      input.nextChargeOf(subscription),
      subscription.frequency,
      window.today,
      window.horizonEnd,
      window.maxSteps,
    );
    for (const chargeDate of charges) {
      const date = localDay(chargeDate);
      if (paid.get(subscription.id)?.has(date)) continue;
      items.push({
        date,
        label: subscription.vendorName,
        amount,
        source: 'subscription',
        sourceId: subscription.id,
        isOverdue: false,
      });
    }
  }
  return items;
}
