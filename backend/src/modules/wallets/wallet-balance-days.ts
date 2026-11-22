/** Every day of a YYYY-MM month as YYYY-MM-DD, first to last. */
export function monthDates(month: string): string[] {
  const [year, monthIndex] = month.split('-').map(Number);
  const length = new Date(Date.UTC(year, monthIndex, 0)).getUTCDate();
  return Array.from({ length }, (_, day) => `${month}-${String(day + 1).padStart(2, '0')}`);
}

/**
 * An account's balance at the end of each of `dates` (ascending): its opening
 * balance plus every day's net up to and including that day, so a day without
 * rows carries the day before.
 */
export function balanceDays(
  initialBalance: number,
  ledgerDays: ReadonlyArray<{ date: string; net: number }>,
  dates: readonly string[],
): number[] {
  let balance = initialBalance;
  let next = 0;
  return dates.map(date => {
    while (next < ledgerDays.length && ledgerDays[next].date <= date) {
      balance += ledgerDays[next].net;
      next += 1;
    }
    return balance;
  });
}
