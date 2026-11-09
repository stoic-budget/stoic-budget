/**
 * Calendar arithmetic for loan schedules, on `YYYY-MM-DD` strings in UTC so a
 * time zone or a daylight-saving change never moves a payment by a day.
 */

const DAY_MS = 86_400_000;

interface Day {
  year: number;
  month: number;
  day: number;
}

const parse = (date: string): Day => ({
  year: Number(date.slice(0, 4)),
  month: Number(date.slice(5, 7)),
  day: Number(date.slice(8, 10)),
});

const pad = (value: number, size = 2) => String(value).padStart(size, '0');

const format = ({ year, month, day }: Day): string => `${pad(year, 4)}-${pad(month)}-${pad(day)}`;

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** `paymentDay` in the month `months` after the month of `date`, pulled back to the month's end (31 → 30 April). */
export function paymentDateAfter(date: string, months: number, paymentDay: number): string {
  const { year, month } = parse(date);
  const index = year * 12 + (month - 1) + months;
  const target = { year: Math.floor(index / 12), month: (index % 12) + 1 };
  return format({ ...target, day: Math.min(paymentDay, daysInMonth(target.year, target.month)) });
}

/** The day `date` would have if it fell on the payment day of its own month. */
export function isPaymentDay(date: string, paymentDay: number): boolean {
  return paymentDateAfter(date, 0, paymentDay) === date;
}

/** Calendar days from `from` to `to` (the interest days of actual/365). */
export function actualDays(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);
}

/**
 * Days from `from` to `to` under 30E/360 (ISDA): every month has 30 days and a
 * month's last day counts as its 30th, so 31 January to 28 February is 30 days.
 */
export function days360(from: string, to: string): number {
  const day30 = (value: Day) =>
    value.day === daysInMonth(value.year, value.month) ? 30 : Math.min(value.day, 30);
  const a = parse(from);
  const b = parse(to);
  return 360 * (b.year - a.year) + 30 * (b.month - a.month) + (day30(b) - day30(a));
}
