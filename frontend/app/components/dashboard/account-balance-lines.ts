import type { BalanceRow } from '@/app/components/charts/AccountBalanceLines';
import type { WalletBalanceDays } from '@/app/lib/contracts';

/** Accounts drawn as lines of their own; the rest share one "Other" line. */
export const OWN_LINES = 4;

/** The key of the line the smaller accounts share. */
export const OTHER_LINE = 'other';

export interface BalanceLine {
  /** The account id, or `OTHER_LINE`. */
  key: string;
  name: string;
  isOther: boolean;
  /** The accounts summed into this line. */
  accountIds: string[];
}

/** The reader's calendar day as YYYY-MM-DD (in UTC it can still be yesterday). */
export function todayKey(now: Date = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/** The sum of the balances it has, or null when it has none. */
function sumKnown(values: Array<number | null | undefined>): number | null {
  const known = values.filter((value): value is number => value !== null && value !== undefined);
  return known.length ? known.reduce((sum, value) => sum + value, 0) : null;
}

/**
 * Each day up to `today` with every line's balance; later days are null, so the
 * lines end today rather than run flat into days that have not happened.
 */
export function balanceRows(
  days: WalletBalanceDays['days'],
  lines: BalanceLine[],
  today: string,
): BalanceRow[] {
  return days.map(day => {
    const row: BalanceRow = { date: day.date };
    for (const line of lines) {
      row[line.key] =
        day.date > today ? null : sumKnown(line.accountIds.map(id => day.balances[id]));
    }
    return row;
  });
}

/** Each line's balance on the latest row that has one. */
export function latestBalances(rows: BalanceRow[], lines: BalanceLine[]): Map<string, number> {
  const latest = new Map<string, number>();
  for (const line of lines) {
    const row = rows.findLast(candidate => typeof candidate[line.key] === 'number');
    if (row) {
      latest.set(line.key, row[line.key] as number);
    }
  }
  return latest;
}

/**
 * The lines to draw: the four accounts holding the most (or owing the most),
 * biggest first, each on its own, and the rest summed into one "Other".
 */
export function balanceLines(
  data: WalletBalanceDays,
  today: string,
  otherName: string,
): BalanceLine[] {
  const own = data.accounts.map(account => ({
    key: account.id,
    name: account.name,
    isOther: false,
    accountIds: [account.id],
  }));
  const size = latestBalances(balanceRows(data.days, own, today), own);
  const bySize = [...own].sort(
    (a, b) => Math.abs(size.get(b.key) ?? 0) - Math.abs(size.get(a.key) ?? 0),
  );
  if (bySize.length <= OWN_LINES + 1) {
    return bySize;
  }
  const rest = bySize.slice(OWN_LINES);
  return [
    ...bySize.slice(0, OWN_LINES),
    {
      key: OTHER_LINE,
      name: otherName,
      isOther: true,
      accountIds: rest.flatMap(line => line.accountIds),
    },
  ];
}
