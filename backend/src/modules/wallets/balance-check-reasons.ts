/**
 * The arithmetic behind "Check balance": our balance at the end of a day, and
 * the cheap places a difference with the bank usually hides. Pure functions,
 * so each rule is tested on its own; the service feeds them rows.
 */

/** Two balances within half a cent are the same balance. */
export const CENT = 0.005;

export const round2 = (value: number): number => Math.round(value * 100) / 100;

/** `YYYY-MM-DD` moved by whole days, in UTC so a clock change cannot skip one. */
export function addDays(date: string, days: number): string {
  const day = new Date(`${date}T00:00:00Z`);
  day.setUTCDate(day.getUTCDate() + days);
  return day.toISOString().slice(0, 10);
}

/** The opening balance plus every day's movement up to and including `date`. */
export function balanceAtEndOf(
  opening: number,
  days: ReadonlyArray<{ date: string; net: number }>,
  date: string,
): number {
  return round2(days.filter(day => day.date <= date).reduce((sum, day) => sum + day.net, opening));
}

export interface LaterRow {
  id: string;
  date: string;
  payee: string;
  /** Signed: income up, spending down. */
  amount: number;
}

/** How far after the day a row the bank booked earlier is looked for. */
export const BOOKED_LATER_WINDOW_DAYS = 7;

/**
 * Rows dated just after the day that the bank may already have counted: one
 * row that is exactly the difference, or else every row up to some day after
 * it when together they are. Null when nothing adds up: a near miss is noise.
 * `rows` are those in the window, oldest first.
 */
export function bookedLater(rows: readonly LaterRow[], difference: number): LaterRow[] | null {
  if (Math.abs(difference) < CENT) {
    return null;
  }
  const single = rows.find(row => Math.abs(row.amount - difference) < CENT);
  if (single) {
    return [single];
  }
  let sum = 0;
  for (let index = 0; index < rows.length; index += 1) {
    sum += rows[index].amount;
    const lastOfDay = rows[index + 1]?.date !== rows[index].date;
    if (lastOfDay && Math.abs(sum - difference) < CENT) {
      return rows.slice(0, index + 1);
    }
  }
  return null;
}

export interface CoveredSpan {
  from: string;
  to: string;
}

/** The last day the account's statements cover without a break, up to `date`; null with none. */
export function coverageEnd(spans: readonly CoveredSpan[], date: string): string | null {
  const sorted = [...spans].filter(span => span.from <= date).sort(byStart);
  return sorted.reduce<string | null>(
    (end, span) => (end === null || span.to > end ? span.to : end),
    null,
  );
}

/**
 * Days between the first statement and `date` that no statement covers. The
 * stretch after the last statement counts only when nothing else (a manual
 * row, a synced one) was booked in it: then the bank's rows may be missing.
 */
export function statementGaps(
  spans: readonly CoveredSpan[],
  date: string,
  rowsAfterCoverage: boolean,
): CoveredSpan[] {
  const sorted = [...spans].filter(span => span.from <= date).sort(byStart);
  const gaps: CoveredSpan[] = [];
  let end: string | null = null;
  for (const span of sorted) {
    if (end !== null && span.from > addDays(end, 1)) {
      gaps.push({ from: addDays(end, 1), to: addDays(span.from, -1) });
    }
    if (end === null || span.to > end) {
      end = span.to;
    }
  }
  if (end !== null && end < date && !rowsAfterCoverage) {
    gaps.push({ from: addDays(end, 1), to: date });
  }
  return gaps;
}

function byStart(a: CoveredSpan, b: CoveredSpan): number {
  return a.from < b.from ? -1 : a.from > b.from ? 1 : 0;
}
