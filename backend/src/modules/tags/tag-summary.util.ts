import type { TagSummary } from '../../contracts';
import { rankPayees, round2 } from '../categories/category-summary.util';

/** One group of counted tagged rows: a day, a side, a category and a payee. */
export interface TagSummaryRow {
  /** `YYYY-MM-DD`. */
  day: string;
  type: 'income' | 'expense';
  categoryId: string | null;
  payeeId: string | null;
  count: number;
  /** Already converted into the summary's currency. */
  amount: number;
}

/** The most month bars the page draws: the latest two years of a longer span. */
export const MAX_MONTHS = 24;

/** Every `YYYY-MM` from `first` to `last`, both included, at most the last `MAX_MONTHS`. */
export function monthsBetween(first: string, last: string): string[] {
  const [lastYear, lastMonth] = last.split('-').map(Number);
  const [firstYear, firstMonth] = first.split('-').map(Number);
  const span = (lastYear - firstYear) * 12 + (lastMonth - firstMonth) + 1;
  return Array.from({ length: Math.min(Math.max(span, 1), MAX_MONTHS) }, (_, index) => {
    const date = new Date(Date.UTC(lastYear, lastMonth - 1 - index, 1));
    return date.toISOString().slice(0, 7);
  }).reverse();
}

/**
 * The tag page's figures from its converted rows: both sides over all time,
 * the span the tag was used in, and the larger side by month, by category and
 * by payee. The bars run from the first to the last month of the side they
 * show; a month between without a row is a bar of zero.
 */
export function summarizeTag(
  rows: TagSummaryRow[],
  names: { categories: Map<string, string>; payees: Map<string, string> },
): Omit<TagSummary, 'tag' | 'currency' | 'missingRates'> {
  const total = { income: 0, expense: 0 };
  for (const row of rows) {
    total[row.type] += row.amount;
  }
  const direction = total.income > total.expense ? 'income' : 'expense';
  const days = rows.map(row => row.day).sort();
  const firstDate = days[0] ?? null;
  const lastDate = days.at(-1) ?? null;
  // The bars span the side they plot: a late refund must not push old spending out of view.
  const plotted = rows
    .filter(row => row.type === direction)
    .map(row => row.day.slice(0, 7))
    .sort();

  const byMonth = new Map<string, number>();
  const byCategory = new Map<string | null, number>();
  const byPayee = new Map<string, { amount: number; count: number }>();
  for (const row of rows.filter(entry => entry.type === direction)) {
    const month = row.day.slice(0, 7);
    byMonth.set(month, (byMonth.get(month) ?? 0) + row.amount);
    byCategory.set(row.categoryId, (byCategory.get(row.categoryId) ?? 0) + row.amount);
    if (row.payeeId) {
      const payee = byPayee.get(row.payeeId) ?? { amount: 0, count: 0 };
      payee.amount += row.amount;
      payee.count += row.count;
      byPayee.set(row.payeeId, payee);
    }
  }

  return {
    spent: round2(total.expense),
    received: round2(total.income),
    net: round2(total.income - total.expense),
    firstDate,
    lastDate,
    direction,
    months:
      plotted.length > 0
        ? monthsBetween(plotted[0], plotted[plotted.length - 1]).map(month => ({
            month,
            amount: round2(byMonth.get(month) ?? 0),
          }))
        : [],
    categories: [...byCategory]
      .filter(([, amount]) => amount !== 0)
      .map(([id, amount]) => ({
        id,
        name: id ? (names.categories.get(id) ?? null) : null,
        amount: round2(amount),
      }))
      .sort((a, b) => b.amount - a.amount),
    topPayees: rankPayees(byPayee, names.payees),
  };
}
