/**
 * Today as the person's own clock has it, `YYYY-MM-DD`. Never
 * `new Date().toISOString().slice(0, 10)`: that is Greenwich's day, yesterday
 * in Europe after midnight and tomorrow in the Americas in the evening.
 */
export function localToday(now: Date = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}
