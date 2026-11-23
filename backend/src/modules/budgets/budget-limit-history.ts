import type { Budget, BudgetLimitChange } from '../../entities/budget.entity';
import { parseDateOnly } from './budget-period.util';
import type { PastPeriod } from './budget-rollover.util';

/** A day as `YYYY-MM-DD` in local time, as budget periods are counted. */
function dayOf(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * The limit a period ended under: the oldest limit replaced after its last
 * day, else the current one. Rollover counts each past period at its own
 * limit, so raising the limit today does not make every past month look
 * underspent (nor lowering it overspent).
 */
export function limitAt(budget: Pick<Budget, 'limitAmount' | 'limitHistory'>, end: Date): number {
  const last = dayOf(end);
  const history = Array.isArray(budget.limitHistory) ? budget.limitHistory : [];
  const replaced = [...history]
    .sort((a, b) => a.until.localeCompare(b.until))
    .find(change => change.until > last);
  return replaced ? Number(replaced.amount) : Number(budget.limitAmount);
}

/**
 * The history to store when an update changes the limit: the old limit, up to
 * today. Nothing is assigned when the limit stays; a new currency starts over.
 */
export function limitHistoryAfter(
  budget: Pick<Budget, 'limitAmount' | 'limitHistory' | 'currency'>,
  update: { limitAmount?: number | string | null; currency?: string | null },
  today = new Date(),
): Partial<Pick<Budget, 'limitHistory'>> {
  // Old limits are amounts in the old currency, and spending is converted into
  // the new one: in another currency the past counts at the current limit, as
  // before there was a history.
  if (update.currency && update.currency.toUpperCase() !== budget.currency.toUpperCase()) {
    return { limitHistory: [] };
  }
  if (update.limitAmount == null || Number(update.limitAmount) === Number(budget.limitAmount)) {
    return {};
  }
  const change: BudgetLimitChange = { until: dayOf(today), amount: Number(budget.limitAmount) };
  return { limitHistory: [...(budget.limitHistory ?? []), change] };
}

/** Each settled period's spending (rows in the budget's currency) and the limit it had. */
export function pastPeriods(
  budget: Pick<Budget, 'limitAmount' | 'limitHistory'>,
  periods: Array<{ start: Date; end: Date }>,
  rows: Array<{ date: string | Date; value: number | null }>,
): PastPeriod[] {
  return periods.map(period => ({
    limit: limitAt(budget, period.end),
    spent: rows.reduce((sum, row) => {
      const at = parseDateOnly(row.date).getTime();
      return row.value !== null && at >= period.start.getTime() && at <= period.end.getTime()
        ? sum + row.value
        : sum;
    }, 0),
  }));
}
