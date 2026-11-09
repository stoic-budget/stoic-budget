/**
 * When a regular payer pays next, from its history. Pure, so the planner can
 * be tested with fixed paydays.
 *
 * `detectRecurringIncome` finds the payer and its rhythm; this reads the
 * rhythm more closely than "every N days":
 * - a monthly payer pays on its usual day of the month (the median, so one
 *   payday moved for a weekend does not move the rest);
 * - a payer twice a month on two fixed days (the 10th and the 25th) keeps
 *   both days instead of drifting every 15 days;
 * - a weekly or fortnightly payer keeps its interval from the last payday.
 *
 * A projected day-of-month payday on a weekend moves back to the Friday,
 * unless the payer's history has weekend paydays (then the bank books on
 * weekends and the day stays).
 */
import type { PaycheckCadence } from '../../contracts';
import { addDays, type RecurringIncome } from './forecast.engine';

export interface PaydaySchedule {
  cadence: PaycheckCadence;
  intervalDays: number;
  /** One day for a monthly payer, two for a twice-a-month one; empty otherwise. */
  daysOfMonth: number[];
  paysOnWeekends: boolean;
}

export interface ProjectedPayday {
  date: string;
  /** Expected before today and not in yet: lands on today. */
  isLate: boolean;
}

/** Paydays this far apart from one another are one cluster of "the same day". */
const SAME_DAY_SPREAD = 5;

export function scheduleOf(
  income: Pick<RecurringIncome, 'intervalDays' | 'dayOfMonth'>,
  paydays: string[],
): PaydaySchedule {
  const paysOnWeekends = paydays.some(isWeekend);
  const intervalDays = income.intervalDays;
  if (income.dayOfMonth !== null) {
    return { cadence: 'monthly', intervalDays, daysOfMonth: [usualDay(paydays)], paysOnWeekends };
  }
  if (intervalDays >= 12 && intervalDays <= 18) {
    const clusters = dayClusters(paydays.map(day => Number(day.slice(8, 10))));
    const daysOfMonth = clusters.map(clusterDay).sort((a, b) => a - b);
    // Every two weeks also falls on two days a month over a short history:
    // the reading that misses the real paydays by fewer days wins.
    if (
      clusters.length === 2 &&
      dayOfMonthMiss(paydays, daysOfMonth, paysOnWeekends) < intervalMiss(paydays, intervalDays)
    ) {
      return { cadence: 'semimonthly', intervalDays, daysOfMonth, paysOnWeekends };
    }
  }
  const cadence: PaycheckCadence =
    intervalDays >= 6 && intervalDays <= 8
      ? 'weekly'
      : intervalDays >= 13 && intervalDays <= 15
        ? 'fortnightly'
        : 'other';
  return { cadence, intervalDays, daysOfMonth: [], paysOnWeekends };
}

/**
 * Paydays after `lastDate` up to `horizonEnd`. One missed by more than the
 * payer's usual wobble is skipped; one a little late lands on today.
 */
export function projectPaydays(
  schedule: PaydaySchedule,
  lastDate: string,
  today: string,
  horizonEnd: string,
): ProjectedPayday[] {
  const wobble = Math.max(3, schedule.intervalDays * 0.25);
  const lateFrom = addDays(today, -Math.floor(wobble));
  const upcoming: ProjectedPayday[] = [];
  let late = false;
  for (const date of candidates(schedule, lastDate, horizonEnd)) {
    if (date < lateFrom) continue;
    if (date < today) {
      late = true;
      continue;
    }
    upcoming.push({ date, isLate: false });
  }
  if (!late || upcoming[0]?.date === today) return upcoming;
  return [{ date: today, isLate: true }, ...upcoming];
}

function* candidates(
  schedule: PaydaySchedule,
  lastDate: string,
  horizonEnd: string,
): Generator<string> {
  if (schedule.daysOfMonth.length === 0) {
    let date = addDays(lastDate, schedule.intervalDays);
    for (let guard = 0; date <= horizonEnd && guard < 400; guard += 1) {
      yield date;
      date = addDays(date, schedule.intervalDays);
    }
    return;
  }
  // A payday this close after the last one is the same payday booked early or late.
  const minGap = Math.ceil(schedule.intervalDays / 2);
  const earliest = addDays(lastDate, minGap);
  let [year, month] = lastDate.split('-').map(Number);
  for (let guard = 0; guard < 40; guard += 1) {
    for (const day of schedule.daysOfMonth) {
      const date = shiftWeekend(dayInMonth(year, month, day), schedule.paysOnWeekends);
      if (date > horizonEnd) return;
      if (date >= earliest) yield date;
    }
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
}

function dayInMonth(year: number, month: number, day: number): string {
  const last = new Date(year, month, 0).getDate();
  return `${year}-${pad(month)}-${pad(Math.min(day, last))}`;
}

function shiftWeekend(date: string, paysOnWeekends: boolean): string {
  if (paysOnWeekends) return date;
  const weekday = weekdayOf(date);
  return weekday === 6 ? addDays(date, -1) : weekday === 0 ? addDays(date, -2) : date;
}

export function isWeekend(date: string): boolean {
  const weekday = weekdayOf(date);
  return weekday === 0 || weekday === 6;
}

function weekdayOf(date: string): number {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

/** Days of the month grouped where they sit close together; the 30th and the 1st are neighbours. */
function dayClusters(days: number[]): number[][] {
  const sorted = [...days].sort((a, b) => a - b);
  const clusters: number[][] = [];
  for (const day of sorted) {
    const last = clusters[clusters.length - 1];
    if (last && day - last[last.length - 1] <= SAME_DAY_SPREAD) last.push(day);
    else clusters.push([day]);
  }
  if (clusters.length > 1) {
    const first = clusters[0];
    const last = clusters[clusters.length - 1];
    if (first[0] + 31 - last[last.length - 1] <= SAME_DAY_SPREAD) {
      clusters[0] = [...last, ...first.map(day => day + 31)];
      clusters.pop();
    }
  }
  return clusters;
}

/** A cluster's usual day; one that wrapped past the month end comes back into 1–31. */
function clusterDay(cluster: number[]): number {
  const day = median(cluster);
  return day > 31 ? day - 31 : day;
}

/** A monthly payer's day; paydays moved back from the 1st to the 30th or 31st still read as the 1st. */
function usualDay(paydays: string[]): number {
  const days = paydays.map(day => Number(day.slice(8, 10)));
  const clusters = dayClusters(days);
  return clusters.length === 1 ? clusterDay(clusters[0]) : median(days);
}

/** Days the paydays sit from a fixed step back from the last one. */
function intervalMiss(paydays: string[], intervalDays: number): number {
  const last = paydays[paydays.length - 1];
  return paydays.reduce(
    (miss, day, index) =>
      miss + Math.abs(daysApart(day, addDays(last, -intervalDays * (paydays.length - 1 - index)))),
    0,
  );
}

/** Days the paydays sit from the nearest of the given days of the month (weekends moved as projected). */
function dayOfMonthMiss(paydays: string[], daysOfMonth: number[], paysOnWeekends: boolean): number {
  return paydays.reduce((miss, day) => {
    const [year, month] = day.split('-').map(Number);
    const near = [month - 1, month, month + 1].flatMap(around =>
      daysOfMonth.map(dayOfMonth => {
        const shifted = around < 1 ? [year - 1, 12] : around > 12 ? [year + 1, 1] : [year, around];
        const date = shiftWeekend(dayInMonth(shifted[0], shifted[1], dayOfMonth), paysOnWeekends);
        return Math.abs(daysApart(day, date));
      }),
    );
    return miss + Math.min(...near);
  }, 0);
}

function daysApart(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}
