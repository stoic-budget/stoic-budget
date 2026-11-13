import type { CategorySummary } from '../../contracts';

/** A category as the summary needs it. */
export interface CategoryNode {
  id: string;
  name: string;
  parentId: string | null;
}

/** One group of counted rows: a day, a currency, a category, and the payee when readable. */
export interface SummaryRow {
  /** `YYYY-MM-DD`. */
  day: string;
  categoryId: string;
  /** Null for rows without a payee and for another member's private rows. */
  payeeId: string | null;
  count: number;
  /** Already converted into the summary's currency. */
  amount: number;
}

const TOP_PAYEES = 5;

export const round2 = (value: number) => Math.round(value * 100) / 100;

/**
 * The branch each category of `rootId`'s tree belongs to: the root itself for
 * its own rows, a direct child for that child and everything under it. A loop
 * of parents ends where it closes.
 */
export function branchesOf(rootId: string, categories: CategoryNode[]): Map<string, string> {
  const children = new Map<string, string[]>();
  for (const category of categories) {
    if (category.parentId) {
      children.set(category.parentId, [...(children.get(category.parentId) ?? []), category.id]);
    }
  }
  const branch = new Map<string, string>([[rootId, rootId]]);
  const queue = (children.get(rootId) ?? []).map(id => [id, id] as const);
  while (queue.length > 0) {
    const [id, top] = queue.shift() as readonly [string, string];
    if (branch.has(id)) {
      continue;
    }
    branch.set(id, top);
    for (const child of children.get(id) ?? []) {
      queue.push([child, top]);
    }
  }
  return branch;
}

/**
 * The figures of the category page from its converted rows. The average
 * leaves out this month (still running) and every month without a row, so a
 * quiet gap does not read as a month of zero.
 */
export function summarize(
  root: CategoryNode,
  categories: CategoryNode[],
  rows: SummaryRow[],
  months: string[],
  payeeNames: Map<string, string>,
): Pick<
  CategorySummary,
  'months' | 'thisMonth' | 'averagePerMonth' | 'lastYearTotal' | 'subcategories' | 'topPayees'
> {
  const branch = branchesOf(root.id, categories);
  const byMonth = new Map<string, number>();
  const byBranch = new Map<string, number>();
  const byPayee = new Map<string, { amount: number; count: number }>();
  for (const row of rows) {
    const month = row.day.slice(0, 7);
    byMonth.set(month, (byMonth.get(month) ?? 0) + row.amount);
    const top = branch.get(row.categoryId) ?? root.id;
    byBranch.set(top, (byBranch.get(top) ?? 0) + row.amount);
    if (row.payeeId) {
      const payee = byPayee.get(row.payeeId) ?? { amount: 0, count: 0 };
      payee.amount += row.amount;
      payee.count += row.count;
      byPayee.set(row.payeeId, payee);
    }
  }

  const current = months[months.length - 1];
  // A month with a row, refunds netted to nothing included; one without is a gap.
  const seen = new Set(rows.filter(row => row.amount !== 0).map(row => row.day.slice(0, 7)));
  const withData = months
    .slice(0, -1)
    .filter(month => seen.has(month))
    .map(month => byMonth.get(month) ?? 0);
  const names = new Map(categories.map(category => [category.id, category.name]));
  const hasChildren = categories.some(category => category.parentId === root.id);

  return {
    months: months.map(month => ({ month, amount: round2(byMonth.get(month) ?? 0) })),
    thisMonth: round2(byMonth.get(current) ?? 0),
    averagePerMonth:
      withData.length > 0
        ? round2(withData.reduce((sum, amount) => sum + amount, 0) / withData.length)
        : null,
    lastYearTotal: round2([...byMonth.values()].reduce((sum, amount) => sum + amount, 0)),
    subcategories: hasChildren
      ? [...byBranch]
          .map(([id, amount]) => ({ id, name: names.get(id) ?? root.name, amount: round2(amount) }))
          .filter(entry => entry.amount !== 0)
          .sort((a, b) => b.amount - a.amount)
      : [],
    topPayees: [...byPayee]
      .filter(([id, totals]) => payeeNames.has(id) && totals.amount !== 0)
      .map(([id, totals]) => ({
        id,
        name: payeeNames.get(id) as string,
        amount: round2(totals.amount),
        count: totals.count,
      }))
      .sort((a, b) => b.amount - a.amount || b.count - a.count)
      .slice(0, TOP_PAYEES),
  };
}
