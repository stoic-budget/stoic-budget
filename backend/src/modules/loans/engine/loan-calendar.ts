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

/**
 * The shortest first period, in calendar days. A payment day closer to the
 * start than this is not the first payment: the one a month later is.
 */
export const MIN_FIRST_PERIOD_DAYS = 15;

/**
 * Months from the start's month to the month of the first payment: the first
 * payment day after the start that leaves at least MIN_FIRST_PERIOD_DAYS. A
 * first period so runs from half a month to about a month and a half: 3 March
 * with payment day 31 first pays on 31 March (28 days, not 30 April's 58), and
 * 20 January with payment day 1 on 1 March (40 days, not 1 February's 12). A
 * start on the payment day pays a whole month later.
 */
export function firstPaymentMonth(startDate: string, paymentDay: number): number {
  let months = 0;
  while (
    actualDays(startDate, paymentDateAfter(startDate, months, paymentDay)) < MIN_FIRST_PERIOD_DAYS
  ) {
    months += 1;
  }
  return months;
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
