import { type ForecastEvent, sameParty } from './forecast.engine';

const DAY_MS = 86_400_000;
const days = (from: string, to: string): number =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);

/**
 * The recurring payments an open invoice or receivable stands for. A client
 * who pays monthly and was invoiced for November pays once in November: the
 * invoice is that payment, so the nearest expected payday of the same payer is
 * dropped, one per invoice, and the invoice is marked to end "safe to spend"
 * as the payday did. Matched like the paycheck planner: within the payer's
 * usual wobble (a quarter of its interval, at least 3 days). An invoice much
 * smaller than the payday (a reimbursement) is extra money, and an overdue
 * one (moved to today) stands for the payday it missed, not the next.
 */
export function withoutInvoicedIncome(
  income: ForecastEvent[],
  expected: ForecastEvent[],
  intervalDaysOf: (sourceId: string) => number,
): ForecastEvent[] {
  const covered = new Set<ForecastEvent>();
  for (const bill of expected) {
    if (bill.amount <= 0) continue;
    const distance = (event: ForecastEvent) => Math.abs(days(bill.date, event.date));
    const [nearest] = income
      .filter(
        event =>
          !covered.has(event) &&
          sameParty(event.label, bill.label) &&
          distance(event) <= Math.max(3, intervalDaysOf(event.sourceId) * 0.25) &&
          bill.amount >= event.amount / 2 &&
          (!bill.isOverdue || Boolean(event.isOverdue)),
      )
      .sort((a, b) => distance(a) - distance(b));
    if (nearest) {
      covered.add(nearest);
      bill.standsForIncome = true;
    }
  }
  return income.filter(event => !covered.has(event));
}
