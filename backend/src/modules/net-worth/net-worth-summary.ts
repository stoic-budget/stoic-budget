import type { NetWorthAssetLine, NetWorthClassificationItem, NetWorthPoint } from '../../contracts';
import type { BalanceAccount } from '../../entities';
import { round2 } from './net-worth-math';

/**
 * Totals per classification bucket, with unlabelled lines kept as their own
 * `null` bucket rather than dropped — how much is still unclassified is worth
 * seeing, not hiding.
 */
export function groupBy(
  lines: NetWorthAssetLine[],
  pick: (line: NetWorthAssetLine) => string | null,
  total: number,
): NetWorthClassificationItem[] {
  const totals = new Map<string | null, number>();
  for (const line of lines) {
    const key = pick(line);
    totals.set(key, (totals.get(key) ?? 0) + line.amount);
  }

  return [...totals.entries()]
    .map(([key, amount]) => ({
      key,
      amount: round2(amount),
      percent: total > 0 ? round2((amount / total) * 100) : 0,
    }))
    .filter(item => item.amount !== 0)
    .sort((a, b) => b.amount - a.amount);
}

export function findLeaves(accounts: BalanceAccount[]): BalanceAccount[] {
  const parentIds = new Set(
    accounts.map(account => account.parentId).filter((id): id is string => Boolean(id)),
  );
  return accounts.filter(account => !parentIds.has(account.id));
}

/** The peak of a series, or null when it never rose above zero. */
export function highestPoint(points: NetWorthPoint[]): { value: number; date: string } | null {
  let best: NetWorthPoint | null = null;
  for (const point of points) {
    if (!best || point.value > best.value) best = point;
  }
  return best && best.value > 0 ? { value: best.value, date: best.date } : null;
}
