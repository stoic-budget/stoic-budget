import type { WalletCoverage } from '@/app/lib/contracts';

export type CoverageRow = WalletCoverage['rows'][number];

/** Days into a month a bank is given to issue the statement of the month before. */
export const STATEMENT_GRACE_DAYS = 5;

export type CoverageStatus =
  /** The data stops before `expected`; `month` (YYYY-MM) is the first one missing. */
  | { kind: 'behind'; month: string }
  /** The booked balance differs from the statement's closing one by `amount`. */
  | { kind: 'differs'; amount: number }
  /** Rows of it still wait in Review. */
  | { kind: 'waiting'; count: number }
  | { kind: 'ok' };

const pad = (value: number) => String(value).padStart(2, '0');

/** The last day of the month `back` months before `today`'s, as YYYY-MM-DD. */
function monthEnd(today: Date, back: number): string {
  const end = new Date(today.getFullYear(), today.getMonth() - back + 1, 0);
  return `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}`;
}

/**
 * The day a bank account's data should reach by `today`, in the reader's own
 * calendar: the end of last month, once a bank has had a few days to issue its
 * statement; before that, the end of the month before.
 */
export function expectedThrough(today: Date): string {
  return monthEnd(today, today.getDate() > STATEMENT_GRACE_DAYS ? 1 : 2);
}

/** The month (YYYY-MM) after the one `day` (YYYY-MM-DD) falls in. */
function monthAfter(day: string): string {
  const [year, month] = day.split('-').map(Number);
  const next = new Date(year, month, 1);
  return `${next.getFullYear()}-${pad(next.getMonth() + 1)}`;
}

/** The one thing to say of a row: the first that applies of behind, differs, waiting. */
export function coverageStatus(row: CoverageRow, today: Date): CoverageStatus {
  if (row.dataTo && row.dataTo < expectedThrough(today)) {
    return { kind: 'behind', month: monthAfter(row.dataTo) };
  }
  if (row.reconciliation && !row.reconciliation.matches) {
    return {
      kind: 'differs',
      amount: Math.abs(row.reconciliation.statementBalance - row.reconciliation.computedBalance),
    };
  }
  if (row.pendingReview > 0) {
    return { kind: 'waiting', count: row.pendingReview };
  }
  return { kind: 'ok' };
}

/** Whether a status asks for something to be done, not only noted. */
export const needsAttention = (status: CoverageStatus): boolean =>
  status.kind === 'behind' || status.kind === 'differs';

/** Rows that need attention first, then by name, each with its status. */
export function byAttention(
  rows: readonly CoverageRow[],
  today: Date,
  nameOf: (row: CoverageRow) => string,
): Array<{ row: CoverageRow; status: CoverageStatus }> {
  return rows
    .map(row => ({ row, status: coverageStatus(row, today) }))
    .sort(
      (a, b) =>
        Number(needsAttention(b.status)) - Number(needsAttention(a.status)) ||
        nameOf(a.row).localeCompare(nameOf(b.row)),
    );
}
