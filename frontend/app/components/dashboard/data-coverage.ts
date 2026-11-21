import type { WalletCoverage } from '@/app/lib/contracts';

export type CoverageRow = WalletCoverage['rows'][number];

/** Days into a month a bank is given to issue the statement of the month before. */
export const STATEMENT_GRACE_DAYS = 5;

/** Months of statements an account may miss before it counts as inactive, not behind. */
export const INACTIVE_AFTER_MONTHS = 3;

export type CoverageStatus =
  /** The data stops in a month before the one due; `month` (YYYY-MM) is the first one missing. */
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

/** How many months back from `today`'s the last statement due falls. */
const monthsDue = (today: Date): number => (today.getDate() > STATEMENT_GRACE_DAYS ? 1 : 2);

/**
 * The day a bank account's data should reach by `today`, in the reader's own
 * calendar: the end of last month, once a bank has had a few days to issue its
 * statement; before that, the end of the month before.
 */
export function expectedThrough(today: Date): string {
  return monthEnd(today, monthsDue(today));
}

/**
 * Whether an account's statements stopped so long ago that it is most likely
 * closed or left: more than `INACTIVE_AFTER_MONTHS` months missing. A gap that
 * old is no longer news, so the account is counted, not listed.
 */
export function isInactive(row: CoverageRow, today: Date): boolean {
  const lastKept = monthEnd(today, monthsDue(today) + INACTIVE_AFTER_MONTHS).slice(0, 7);
  return row.dataTo !== null && row.dataTo.slice(0, 7) < lastKept;
}

/** The month (YYYY-MM) after the one `day` (YYYY-MM-DD) falls in. */
function monthAfter(day: string): string {
  const [year, month] = day.split('-').map(Number);
  const next = new Date(year, month, 1);
  return `${next.getFullYear()}-${pad(next.getMonth() + 1)}`;
}

/**
 * The one thing to say of a row: the first that applies of behind, differs, waiting.
 * Months, not days, decide "behind": a statement may close on the 25th or on the
 * last weekday and still be the month's.
 */
export function coverageStatus(row: CoverageRow, today: Date): CoverageStatus {
  if (row.dataTo && row.dataTo.slice(0, 7) < expectedThrough(today).slice(0, 7)) {
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
