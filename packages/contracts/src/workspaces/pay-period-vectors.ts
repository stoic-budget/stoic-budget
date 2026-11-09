import type { PayPeriodContext } from './pay-period';

/**
 * Cases both sides run `periodBounds` / `periodOf` against (backend and
 * frontend unit tests), so the two copies of the library cannot drift.
 * Plain data, imported by tests only.
 */
export interface PeriodVector {
  name: string;
  context: PayPeriodContext;
  month: string;
  from: string;
  to: string;
}

/** 31 May 2026 is a Sunday; a holiday on Friday the 29th leaves Thursday the 28th. */
const HOLIDAY_WEEKEND = ['2026-05-29'];

const SALARY = {
  dayOfMonth: 25,
  // 25 Oct 2026 is a Sunday: that salary came on Friday the 23rd.
  paydays: ['2026-08-25', '2026-09-25', '2026-10-23'],
};

export const PERIOD_VECTORS: readonly PeriodVector[] = [
  {
    name: 'day 1 is the calendar month',
    context: { monthStart: { kind: 'day', day: 1 } },
    month: '2026-02',
    from: '2026-02-01',
    to: '2026-02-28',
  },
  {
    name: 'day 1 in a leap February',
    context: { monthStart: { kind: 'day', day: 1 } },
    month: '2028-02',
    from: '2028-02-01',
    to: '2028-02-29',
  },
  {
    name: 'day 15 starts in its own month',
    context: { monthStart: { kind: 'day', day: 15 } },
    month: '2026-10',
    from: '2026-10-15',
    to: '2026-11-14',
  },
  {
    name: 'day 15 over December into January',
    context: { monthStart: { kind: 'day', day: 15 } },
    month: '2026-12',
    from: '2026-12-15',
    to: '2027-01-14',
  },
  {
    name: 'day 16 is the first day named after the next month',
    context: { monthStart: { kind: 'day', day: 16 } },
    month: '2026-11',
    from: '2026-10-16',
    to: '2026-11-15',
  },
  {
    name: 'day 25 is named after the month it mostly covers',
    context: { monthStart: { kind: 'day', day: 25 } },
    month: '2027-01',
    from: '2026-12-25',
    to: '2027-01-24',
  },
  {
    name: 'day 31 falls back to the last day of February',
    context: { monthStart: { kind: 'day', day: 31 } },
    month: '2026-03',
    from: '2026-02-28',
    to: '2026-03-30',
  },
  {
    name: 'day 31 in a leap year',
    context: { monthStart: { kind: 'day', day: 31 } },
    month: '2028-03',
    from: '2028-02-29',
    to: '2028-03-30',
  },
  {
    name: 'day 30 runs from 30 January to 27 February',
    context: { monthStart: { kind: 'day', day: 30 } },
    month: '2026-02',
    from: '2026-01-30',
    to: '2026-02-27',
  },
  {
    name: 'last day',
    context: { monthStart: { kind: 'last_day' } },
    month: '2026-03',
    from: '2026-02-28',
    to: '2026-03-30',
  },
  {
    name: 'last business day skips a weekend',
    // 31 Jan and 28 Feb 2026 are Saturdays.
    context: { monthStart: { kind: 'last_business_day' } },
    month: '2026-02',
    from: '2026-01-30',
    to: '2026-02-26',
  },
  {
    name: 'last business day skips a holiday before a weekend',
    context: { monthStart: { kind: 'last_business_day' }, holidays: HOLIDAY_WEEKEND },
    month: '2026-06',
    from: '2026-05-28',
    to: '2026-06-29',
  },
  {
    name: 'salary on its booked day when it came early',
    context: { monthStart: { kind: 'salary' }, salary: SALARY },
    month: '2026-11',
    from: '2026-10-23',
    to: '2026-11-24',
  },
  {
    name: 'salary on the expected day when nothing is booked yet',
    context: { monthStart: { kind: 'salary' }, salary: SALARY },
    month: '2026-12',
    from: '2026-11-25',
    to: '2026-12-24',
  },
  {
    name: 'salary previous period ends the day before the early payday',
    context: { monthStart: { kind: 'salary' }, salary: SALARY },
    month: '2026-10',
    from: '2026-09-25',
    to: '2026-10-22',
  },
  {
    name: 'salary without a detected salary is the calendar month',
    context: { monthStart: { kind: 'salary' }, salary: null },
    month: '2026-10',
    from: '2026-10-01',
    to: '2026-10-31',
  },
];

export interface PeriodOfVector {
  name: string;
  context: PayPeriodContext;
  date: string;
  month: string;
}

export const PERIOD_OF_VECTORS: readonly PeriodOfVector[] = [
  {
    name: 'day 1',
    context: { monthStart: { kind: 'day', day: 1 } },
    date: '2026-12-31',
    month: '2026-12',
  },
  {
    name: 'day 15, before the start',
    context: { monthStart: { kind: 'day', day: 15 } },
    date: '2026-11-09',
    month: '2026-10',
  },
  {
    name: 'day 15, on the start',
    context: { monthStart: { kind: 'day', day: 15 } },
    date: '2026-11-15',
    month: '2026-11',
  },
  {
    name: 'day 15, early January belongs to December',
    context: { monthStart: { kind: 'day', day: 15 } },
    date: '2027-01-03',
    month: '2026-12',
  },
  {
    name: 'day 25, late December belongs to January',
    context: { monthStart: { kind: 'day', day: 25 } },
    date: '2026-12-28',
    month: '2027-01',
  },
  {
    name: 'salary booked early',
    context: { monthStart: { kind: 'salary' }, salary: SALARY },
    date: '2026-10-23',
    month: '2026-11',
  },
];
