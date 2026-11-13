import type {
  CoverageChainBreak,
  CoverageDuplicateKind,
  CoverageMonth,
  CoverageMovementMismatch,
  CoverageOverlap,
  CoveragePeriod,
  CoverageRange,
  CoverageSource,
  StatementCoverage,
} from '../../contracts';

/** One statement of an account with what its rows add up to, as the service reads it. */
export interface CoverageInput {
  id: string;
  fileName: string;
  /** The period the statement prints, `YYYY-MM-DD`. */
  from: string | null;
  to: string | null;
  /** Its first and last row dates: stand-ins when it prints no period. */
  rowsFrom: string | null;
  rowsTo: string | null;
  source: CoverageSource;
  status: string;
  balanceStart: number | null;
  balanceEnd: number | null;
  counted: number;
  pending: number;
  rowCount: number;
  fileHash: string;
  sourceAccountIndex: number | null;
  createdAt: string;
  /** Per other statement, how many of this one's rows dedupe flagged as copies of its rows. */
  duplicateRowsOf: Array<{ statementId: string; count: number }>;
}

const DAY_MS = 86_400_000;
/** Below half a cent two amounts are the same. */
const CENT = 0.005;

const dayOf = (date: string): number => Math.round(Date.parse(`${date}T00:00:00Z`) / DAY_MS);
const dateOf = (day: number): string => new Date(day * DAY_MS).toISOString().slice(0, 10);
const cents = (value: number): number => Math.round(value * 100) / 100;
const range = (from: number, to: number): CoverageRange => ({
  from: dateOf(from),
  to: dateOf(to),
  days: to - from + 1,
});

interface Dated {
  input: CoverageInput;
  from: number;
  to: number;
  inferred: boolean;
  duplicateOf: { statementId: string; kind: CoverageDuplicateKind } | null;
}

function dated(input: CoverageInput): Dated | null {
  const from = input.from ?? input.rowsFrom;
  const to = input.to ?? input.rowsTo;
  if (!(from && to)) {
    return null;
  }
  const [low, high] = [dayOf(from), dayOf(to)].sort((a, b) => a - b);
  return { input, from: low, to: high, inferred: !(input.from && input.to), duplicateOf: null };
}

/** Both print the balance and the two differ: not the same month twice, whatever the dates say. */
const balanceDiffers = (a: number | null, b: number | null): boolean =>
  a !== null && b !== null && Math.abs(a - b) >= CENT;

/**
 * A later statement is a copy of an earlier one when it is the same file of the
 * same account (uploaded again past the duplicate warning), when dedupe flagged
 * every row of it as a copy of the earlier one's rows and its period lies within
 * the earlier one's (a wider period covers days of its own, rows or not), or
 * when it prints the very same period and the same balances. Two bank feed
 * pulls of one day share a period honestly.
 */
function duplicateKind(earlier: Dated, later: Dated): CoverageDuplicateKind | null {
  const [a, b] = [earlier.input, later.input];
  if (a.fileHash === b.fileHash && a.sourceAccountIndex === b.sourceAccountIndex) {
    return 'same_file';
  }
  const copied = b.duplicateRowsOf.find(item => item.statementId === a.id)?.count ?? 0;
  const within = later.from >= earlier.from && later.to <= earlier.to;
  if (b.rowCount > 0 && copied === b.rowCount && within) {
    return 'same_rows';
  }
  const bothFeed = a.source === 'bank_sync' && b.source === 'bank_sync';
  const sameBalances = !(
    balanceDiffers(a.balanceStart, b.balanceStart) || balanceDiffers(a.balanceEnd, b.balanceEnd)
  );
  return !bothFeed && sameBalances && earlier.from === later.from && earlier.to === later.to
    ? 'same_range'
    : null;
}

/** A copy points at the original, also when what it copies is itself a copy. */
function markDuplicates(periods: Dated[]): void {
  const byAge = [...periods].sort((a, b) => a.input.createdAt.localeCompare(b.input.createdAt));
  for (const [index, later] of byAge.entries()) {
    for (const earlier of byAge.slice(0, index)) {
      const kind = duplicateKind(earlier, later);
      if (kind) {
        later.duplicateOf = {
          statementId: earlier.duplicateOf?.statementId ?? earlier.input.id,
          kind,
        };
        break;
      }
    }
  }
}

/**
 * Covered days as sorted, disjoint [from, to] runs. A bank feed pull's
 * statement carries the days the feed asked for, not only its rows' dates
 * (`bank-sync-pull.service`), so a day between two pulls is covered only when
 * a pull asked for it.
 */
function coveredRuns(live: Dated[]): Array<[number, number]> {
  const spans: Array<[number, number]> = live.map(period => [period.from, period.to]);
  spans.sort((a, b) => a[0] - b[0]);
  const runs: Array<[number, number]> = [];
  for (const [from, to] of spans) {
    const last = runs[runs.length - 1];
    if (last && from <= last[1] + 1) {
      last[1] = Math.max(last[1], to);
    } else {
      runs.push([from, to]);
    }
  }
  return runs;
}

function overlapsOf(live: Dated[]): CoverageOverlap[] {
  const overlaps: CoverageOverlap[] = [];
  for (const [index, a] of live.entries()) {
    for (const b of live.slice(index + 1)) {
      const from = Math.max(a.from, b.from);
      const to = Math.min(a.to, b.to);
      // A feed re-asks a few days back on every pull; its own rows are deduped by id.
      const bothFeed = a.input.source === 'bank_sync' && b.input.source === 'bank_sync';
      if (from <= to && !bothFeed) {
        overlaps.push({ ...range(from, to), statementIds: [a.input.id, b.input.id] });
      }
    }
  }
  return overlaps;
}

/**
 * Each statement against the one that reaches furthest before it: a short
 * statement inside a longer one is not the predecessor of what follows both.
 */
function chainBreaksOf(live: Dated[]): CoverageChainBreak[] {
  const breaks: CoverageChainBreak[] = [];
  let reach: Dated | undefined;
  for (const b of live) {
    const a = reach;
    if (!a || b.to > a.to) {
      reach = b;
    }
    const closing = a?.input.balanceEnd ?? null;
    const opening = b.input.balanceStart;
    // Overlapping statements are not one after the other: their balances need not meet.
    if (!a || b.from <= a.to || closing === null || opening === null) {
      continue;
    }
    const difference = cents(opening - closing);
    if (Math.abs(difference) >= CENT) {
      breaks.push({
        fromStatementId: a.input.id,
        toStatementId: b.input.id,
        date: dateOf(b.from),
        closing,
        opening,
        difference,
        afterGap: b.from > a.to + 1,
      });
    }
  }
  return breaks;
}

/**
 * Opening balance plus every row of the statement against its closing
 * balance. Rows still waiting in Review are the statement's rows all the
 * same, so they explain their share; only what no row explains is a mismatch.
 */
function movementMismatchesOf(live: Dated[]): CoverageMovementMismatch[] {
  return live.flatMap(({ input, from, to }) => {
    const { balanceStart: opening, balanceEnd: closing, counted, pending } = input;
    if (opening === null || closing === null) {
      return [];
    }
    const difference = cents(closing - opening - counted - pending);
    return Math.abs(difference) < CENT
      ? []
      : [
          {
            statementId: input.id,
            from: dateOf(from),
            to: dateOf(to),
            opening,
            closing,
            counted: cents(counted),
            pending: cents(pending),
            difference,
          },
        ];
  });
}

function monthsOf(
  runs: Array<[number, number]>,
  overlaps: CoverageOverlap[],
  first: number,
  end: number,
): CoverageMonth[] {
  const covered = (day: number) => runs.some(([from, to]) => day >= from && day <= to);
  const overlapped = (day: number) =>
    overlaps.some(item => day >= dayOf(item.from) && day <= dayOf(item.to));
  const months: CoverageMonth[] = [];
  const start = new Date(first * DAY_MS);
  for (
    let cursor = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1);
    cursor / DAY_MS <= end;
    cursor = Date.UTC(new Date(cursor).getUTCFullYear(), new Date(cursor).getUTCMonth() + 1, 1)
  ) {
    const monthStart = cursor / DAY_MS;
    const next = new Date(cursor);
    const monthEnd = Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 1) / DAY_MS - 1;
    let coveredDays = 0;
    let anyOverlap = false;
    const last = Math.min(monthEnd, end);
    for (let day = monthStart; day <= last; day++) {
      coveredDays += covered(day) ? 1 : 0;
      anyOverlap ||= overlapped(day);
    }
    const days = last - monthStart + 1;
    const state = anyOverlap
      ? 'overlap'
      : coveredDays === days
        ? 'covered'
        : coveredDays === 0
          ? 'gap'
          : 'partial';
    months.push({ month: dateOf(monthStart).slice(0, 7), state, coveredDays, days });
  }
  return months;
}

/**
 * Which days an account's statements cover, to the day, and whether their
 * balances hold together: gaps, overlaps, second copies, the chain of closing
 * to next opening balance and each statement's own movement.
 */
export function computeCoverage(
  walletId: string,
  currency: string,
  statements: CoverageInput[],
  today: string,
): StatementCoverage {
  const periods = statements
    .map(dated)
    .filter((period): period is Dated => period !== null)
    .sort(
      (a, b) =>
        a.from - b.from || a.to - b.to || a.input.createdAt.localeCompare(b.input.createdAt),
    );
  markDuplicates(periods);
  const live = periods.filter(period => !period.duplicateOf);
  const runs = coveredRuns(live);
  const first = runs[0]?.[0] ?? null;
  const last = runs[runs.length - 1]?.[1] ?? null;
  const todayDay = dayOf(today);
  const overlaps = overlapsOf(live);
  const chainBreaks = chainBreaksOf(live);
  const movementMismatches = movementMismatchesOf(live);
  const unexplained = cents(
    chainBreaks.reduce((sum, item) => sum + item.difference, 0) +
      movementMismatches.reduce((sum, item) => sum + item.difference, 0),
  );

  return {
    walletId,
    currency,
    firstDay: first === null ? null : dateOf(first),
    lastDay: last === null ? null : dateOf(last),
    periods: periods.map(
      ({ input, from, to, inferred, duplicateOf }): CoveragePeriod => ({
        statementId: input.id,
        fileName: input.fileName,
        from: dateOf(from),
        to: dateOf(to),
        inferred,
        source: input.source,
        status: input.status,
        balanceStart: input.balanceStart,
        balanceEnd: input.balanceEnd,
        counted: cents(input.counted),
        pending: cents(input.pending),
        rowCount: input.rowCount,
        duplicateOf,
      }),
    ),
    gaps: runs.slice(1).map(([from], index) => range(runs[index][1] + 1, from - 1)),
    sinceLast: last !== null && last < todayDay ? range(last + 1, todayDay) : null,
    overlaps,
    chainBreaks,
    movementMismatches,
    unexplained,
    months:
      first === null || last === null
        ? []
        : monthsOf(runs, overlaps, first, Math.max(last, todayDay)),
  };
}
