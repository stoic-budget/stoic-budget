import type { EntityManager } from 'typeorm';
import type { RecurrenceRule } from '../../contracts';
import { lockSeries } from '../payables/series-lock';
import type { ScheduleRow } from './engine/loan-plan';

/**
 * An occurrence nobody has touched yet: still owed in full, no payment against
 * it, not skipped. Only these follow the schedule (amount, dates) or go when
 * the reminders stop; one that was paid, part-paid, skipped or given its own
 * amount stays as the person left it.
 */
export const UNTOUCHED_SQL = `p."status" IN ('to_pay', 'scheduled', 'overdue')
  AND p."paid_amount" = 0 AND p."base_amount" IS NULL AND p."skipped_at" IS NULL
  AND NOT EXISTS (SELECT 1 FROM "payable_payments" pp WHERE pp."payable_id" = p."id")`;

/**
 * The rule that puts a bill on every payment date of the schedule: monthly on
 * the payment day from the first payment, as many as there are payments. The
 * loan calendar pulls a day past the month's end back to its last day, and so
 * does the rule. The dates already past still count towards `count`, so the
 * rule stays the same from one day to the next and changes only with the terms.
 */
export function reminderRule(rows: readonly ScheduleRow[], paymentDay: number): RecurrenceRule {
  return {
    frequency: 'monthly',
    interval: 1,
    startDate: rows[0].date,
    monthDay: paymentDay,
    count: rows.length,
  };
}

/** What each payment date asks for: the scheduled payment and any planned extra on it. */
export function amountsByDate(rows: readonly ScheduleRow[]): Map<string, number> {
  return new Map(rows.map(row => [row.date, Math.round((row.payment + row.extra) * 100) / 100]));
}

/**
 * Ends the reminders of a loan account: every bill series of it stops (no
 * occurrence carries the rule) and its untouched occurrences go. The paid ones
 * stay, as the record of what was paid. In the caller's transaction; safe to
 * run again.
 */
export async function endLoanReminders(
  manager: EntityManager,
  workspaceId: string,
  walletId: string,
): Promise<void> {
  await lockLoan(manager, workspaceId, walletId);
  await endOtherSeries(manager, workspaceId, walletId, null);
}

/** The lock of a loan's bills, held until the transaction ends: one sync or ending at a time. */
export function lockLoan(manager: EntityManager, workspaceId: string, walletId: string) {
  return lockSeries(manager, workspaceId, `loan:${walletId}`);
}

/**
 * Stops every bill series of the loan but `keep` and removes their untouched
 * occurrences; with `keep` null, all of them. Holds the loan lock already.
 */
export async function endOtherSeries(
  manager: EntityManager,
  workspaceId: string,
  walletId: string,
  keep: string | null,
): Promise<void> {
  const series: Array<{ series_id: string }> = await manager.query(
    `SELECT DISTINCT "series_id" FROM "payables"
      WHERE "workspace_id" = $1 AND "loan_wallet_id" = $2 AND "series_id" IS NOT NULL
        AND ($3::uuid IS NULL OR "series_id" <> $3::uuid)`,
    [workspaceId, walletId, keep],
  );
  for (const { series_id: seriesId } of series) {
    await lockSeries(manager, workspaceId, seriesId);
    await manager.query(
      `UPDATE "payables" SET "recurrence" = NULL, "is_recurring" = false
        WHERE "workspace_id" = $1 AND "series_id" = $2`,
      [workspaceId, seriesId],
    );
    await manager.query(
      `DELETE FROM "payables" p
        WHERE p."workspace_id" = $1 AND p."series_id" = $2 AND ${UNTOUCHED_SQL}`,
      [workspaceId, seriesId],
    );
  }
  // Bills of the loan outside any series (none are made so) go with the rest when all end.
  if (keep === null) await deleteUntouched(manager, workspaceId, walletId, null);
}

/**
 * Removes the untouched occurrences of a loan's bills, all of them or those
 * not on one of `keepDates` (a payment date that moved). Removed for good, not
 * soft-deleted: a deleted occurrence holds its day in the series, and the
 * schedule may put a payment on that day again.
 */
export async function deleteUntouched(
  manager: EntityManager,
  workspaceId: string,
  walletId: string,
  keepDates: readonly string[] | null,
): Promise<void> {
  await manager.query(
    `DELETE FROM "payables" p
      WHERE p."workspace_id" = $1 AND p."loan_wallet_id" = $2 AND ${UNTOUCHED_SQL}
        AND ($3::date[] IS NULL OR p."occurrence_date" IS NULL
             OR NOT (p."occurrence_date" = ANY($3::date[])))`,
    [workspaceId, walletId, keepDates],
  );
}
