import type { AppBudgetRow } from './app-model';
import { categoryKey } from './app-plan-categories';

export interface PlannedBudget {
  categoryKey: string;
  name: string;
  limit: number;
}

export interface BudgetPlan {
  /** The month whose assigned amounts become the monthly limits; null without a plan file. */
  month: string | null;
  budgets: PlannedBudget[];
  /** Categories with nothing assigned that month. */
  skipped: number;
}

/**
 * A budget here is one monthly limit per category, not a month-by-month
 * ledger, so the plan's latest month that has begun and has money assigned
 * sets the limits (a plan made only of future months uses its latest one).
 */
export function planBudgets(rows: AppBudgetRow[], today: string): BudgetPlan {
  const current = today.slice(0, 7);
  const funded = [...new Set(rows.filter(row => row.assigned > 0).map(row => row.month))].sort();
  const month = funded.filter(item => item <= current).pop() ?? funded.pop() ?? null;
  if (!month) {
    return {
      month: null,
      budgets: [],
      skipped:
        rows.length > 0 ? new Set(rows.map(row => categoryKey(row.group, row.category))).size : 0,
    };
  }
  const inMonth = new Map<string, AppBudgetRow>();
  for (const row of rows.filter(item => item.month === month)) {
    inMonth.set(categoryKey(row.group, row.category), row);
  }
  const budgets: PlannedBudget[] = [];
  let skipped = 0;
  for (const [key, row] of inMonth) {
    if (row.assigned > 0) {
      budgets.push({ categoryKey: key, name: row.category, limit: row.assigned });
    } else {
      skipped += 1;
    }
  }
  return { month, budgets, skipped };
}
