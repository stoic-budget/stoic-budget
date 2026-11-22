import type { ReportCell } from '../report-document.util';
import type { TemplateReportRow } from '../report-template.types';
import { round2 } from './report-values.util';

/**
 * Where a category sorts: under its group, or — for a top-level category,
 * whose group cell is empty — under its own name, so it sits beside its children.
 */
function groupSortKey(entry: { groupName: string; categoryName: string }): string {
  return entry.groupName || entry.categoryName;
}

/**
 * Largest group first and largest category first within it: a flat category
 * tree reads as before, largest first, and a nested one keeps groups together.
 */
export function byGroupThenAmount<
  T extends { groupName: string; categoryName: string; total: number },
>(entries: T[]): T[] {
  const groupTotal = new Map<string, number>();
  for (const entry of entries) {
    const key = groupSortKey(entry);
    groupTotal.set(key, (groupTotal.get(key) ?? 0) + entry.total);
  }
  return [...entries].sort(
    (a, b) =>
      (groupTotal.get(groupSortKey(b)) ?? 0) - (groupTotal.get(groupSortKey(a)) ?? 0) ||
      groupSortKey(a).localeCompare(groupSortKey(b)) ||
      b.total - a.total,
  );
}

export interface CategoryTotal {
  groupName: string;
  categoryName: string;
  total: number;
  count: number;
}

/**
 * Totals per category, keyed by id: two categories may share a name under
 * different parents, and summing by name would fold them into one line.
 */
export function sumByCategory(rows: TemplateReportRow[]): CategoryTotal[] {
  const totals = new Map<string, CategoryTotal>();

  for (const row of rows) {
    const entry = totals.get(row.categoryKey) ?? {
      groupName: row.groupName,
      categoryName: row.categoryName,
      total: 0,
      count: 0,
    };
    entry.total += row.amount;
    entry.count += 1;
    totals.set(row.categoryKey, entry);
  }

  return Array.from(totals.values());
}

export function sumTotals(entries: CategoryTotal[]): number {
  return entries.reduce((sum, entry) => sum + entry.total, 0);
}

export function toAmountRows(entries: CategoryTotal[]): ReportCell[][] {
  return entries.map(entry => [entry.groupName, entry.categoryName, round2(entry.total)]);
}
