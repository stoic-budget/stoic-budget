import { parseDecimal } from './trade-form';

/** The contract's bounds for a close: what numeric(20,8) stores, above zero. */
export const MIN_CLOSE = 1e-8;
export const MAX_CLOSE = 1e12;

/**
 * The close a form sends, or null while it is not one the server would take:
 * a date no later than today, a price at least one hundred-millionth and
 * below a trillion. Exactly what is shown is sent.
 */
export function buildClose(
  form: { date: string; close: string },
  today: string,
): { date: string; close: number } | null {
  const close = parseDecimal(form.close);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(form.date) || form.date > today) return null;
  if (close === null || !Number.isFinite(close) || close < MIN_CLOSE || close >= MAX_CLOSE) {
    return null;
  }
  return { date: form.date, close };
}

/** Today in the browser's calendar, as the date field writes it. */
export function localToday(now = new Date()): string {
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}
