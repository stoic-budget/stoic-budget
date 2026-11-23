type DayFlow = { date: string; income: number; expense: number };

const MAX_DAYS = 1500;

/** `YYYY-MM-DD` of a local date. */
export const dateKey = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

/**
 * Every day from `since` to `end`, with zeros where nothing was booked: an
 * average over only the days that had rows takes three purchases a month for
 * spending every day.
 */
export function withEmptyDays(history: DayFlow[], since: Date, end: Date): DayFlow[] {
  const byDate = new Map(history.map(day => [day.date, day]));
  const days: DayFlow[] = [];
  // At most the last MAX_DAYS: a cap must cut the old end, never the newest days.
  const earliest = new Date(end.getFullYear(), end.getMonth(), end.getDate() - (MAX_DAYS - 1));
  const start = new Date(since.getFullYear(), since.getMonth(), since.getDate());
  const cursor = start < earliest ? earliest : start;
  for (let guard = 0; cursor <= end && guard < MAX_DAYS; guard += 1) {
    const key = dateKey(cursor);
    days.push(byDate.get(key) ?? { date: key, income: 0, expense: 0 });
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}
