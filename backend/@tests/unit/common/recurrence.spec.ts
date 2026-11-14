import {
  addDays,
  addMonthsClamped,
  daysInMonth,
  localDay,
} from '@/common/recurrence/date-only';
import {
  firstOccurrence,
  gridDate,
  monthlyRuleFrom,
  nextOccurrence,
  occurrencesBetween,
  type RecurrenceRule,
  shiftOffNonWorkingDays,
  yearsBetween,
} from '@/common/recurrence/recurrence';

const rule = (overrides: Partial<RecurrenceRule>): RecurrenceRule => ({
  frequency: 'monthly',
  interval: 1,
  startDate: '2026-01-31',
  ...overrides,
});

describe('date-only', () => {
  it('knows the length of February in leap and common years', () => {
    expect(daysInMonth(2024, 1)).toBe(29);
    expect(daysInMonth(2026, 1)).toBe(28);
    expect(daysInMonth(2000, 1)).toBe(29);
    expect(daysInMonth(1900, 1)).toBe(28);
  });

  it('clamps a month step to the end of a short month and keeps the anchor day', () => {
    expect(addMonthsClamped('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonthsClamped('2026-02-28', 1, 31)).toBe('2026-03-31');
    expect(addMonthsClamped('2024-02-29', 12)).toBe('2025-02-28');
    expect(addMonthsClamped('2026-11-30', 3)).toBe('2027-02-28');
    expect(addMonthsClamped('2026-03-31', -1)).toBe('2026-02-28');
  });

  it('steps across the daylight-saving change without losing a day', () => {
    // Europe moves its clocks on the last Sunday of March and of October.
    expect(addDays('2026-03-28', 1)).toBe('2026-03-29');
    expect(addDays('2026-03-29', 1)).toBe('2026-03-30');
    expect(addDays('2026-10-24', 7)).toBe('2026-10-31');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('reads the local calendar day of a Date', () => {
    expect(localDay(new Date(2026, 0, 5, 23, 30))).toBe('2026-01-05');
  });
});

describe('recurrence rules', () => {
  it('repeats every N days', () => {
    const daily = rule({ frequency: 'daily', interval: 10, startDate: '2026-02-25' });
    expect(occurrencesBetween(daily, '2026-02-01', '2026-03-31')).toEqual([
      '2026-02-25',
      '2026-03-07',
      '2026-03-17',
      '2026-03-27',
    ]);
  });

  it('repeats every N weeks on the start weekday', () => {
    const fortnightly = rule({ frequency: 'weekly', interval: 2, startDate: '2026-03-23' });
    expect(occurrencesBetween(fortnightly, '2026-03-01', '2026-05-01')).toEqual([
      '2026-03-23',
      '2026-04-06',
      '2026-04-20',
    ]);
  });

  it('keeps a monthly rule on the 31st in every month, clamped, never drifting', () => {
    expect(occurrencesBetween(rule({}), '2026-01-01', '2026-05-31')).toEqual([
      '2026-01-31',
      '2026-02-28',
      '2026-03-31',
      '2026-04-30',
      '2026-05-31',
    ]);
  });

  it('falls on 29 February in a leap year and on the 28th otherwise', () => {
    const monthly = rule({ startDate: '2024-01-30', monthDay: 29 });
    expect(occurrencesBetween(monthly, '2024-02-01', '2024-03-31')).toEqual([
      '2024-02-29',
      '2024-03-29',
    ]);
    const yearly = rule({ frequency: 'yearly', startDate: '2024-02-29' });
    expect(occurrencesBetween(yearly, '2024-01-01', '2028-12-31')).toEqual([
      '2024-02-29',
      '2025-02-28',
      '2026-02-28',
      '2027-02-28',
      '2028-02-29',
    ]);
  });

  it('falls on the last day of each month', () => {
    const last = rule({ startDate: '2026-01-10', monthDay: 'last' });
    expect(occurrencesBetween(last, '2026-01-01', '2026-04-30')).toEqual([
      '2026-01-31',
      '2026-02-28',
      '2026-03-31',
      '2026-04-30',
    ]);
  });

  it('skips a grid day before the start: a rule on the 1st starting on the 20th', () => {
    const first = rule({ startDate: '2026-01-20', monthDay: 1 });
    expect(firstOccurrence(first)).toBe('2026-02-01');
    expect(occurrencesBetween(first, '2026-01-01', '2026-03-31')).toEqual([
      '2026-02-01',
      '2026-03-01',
    ]);
  });

  it('falls on the Nth weekday of the month', () => {
    // The second Tuesday: 13 Jan, 10 Feb, 10 Mar 2026.
    const secondTuesday = rule({ startDate: '2026-01-01', nthWeekday: { week: 2, weekday: 2 } });
    expect(occurrencesBetween(secondTuesday, '2026-01-01', '2026-03-31')).toEqual([
      '2026-01-13',
      '2026-02-10',
      '2026-03-10',
    ]);
  });

  it('falls on the last weekday of the month', () => {
    // The last Friday: 30 Jan, 27 Feb, 27 Mar 2026; 26 Feb in 2027's yearly rule.
    const lastFriday = rule({ startDate: '2026-01-01', nthWeekday: { week: -1, weekday: 5 } });
    expect(occurrencesBetween(lastFriday, '2026-01-01', '2026-03-31')).toEqual([
      '2026-01-30',
      '2026-02-27',
      '2026-03-27',
    ]);
    const yearly = rule({
      frequency: 'yearly',
      startDate: '2026-02-01',
      nthWeekday: { week: -1, weekday: 5 },
    });
    expect(nextOccurrence(yearly, '2026-02-27')).toBe('2027-02-26');
  });

  it('repeats every N months and years', () => {
    const quarterly = rule({ interval: 3, startDate: '2026-11-30' });
    expect(occurrencesBetween(quarterly, '2026-11-01', '2027-06-30')).toEqual([
      '2026-11-30',
      '2027-02-28',
      '2027-05-30',
    ]);
    const everyTwoYears = rule({ frequency: 'yearly', interval: 2, startDate: '2026-06-15' });
    expect(nextOccurrence(everyTwoYears, '2026-06-15')).toBe('2028-06-15');
  });

  it('ends on a date', () => {
    const until = rule({ startDate: '2026-01-15', until: '2026-03-15' });
    expect(occurrencesBetween(until, '2026-01-01', '2026-12-31')).toEqual([
      '2026-01-15',
      '2026-02-15',
      '2026-03-15',
    ]);
    expect(nextOccurrence(until, '2026-03-15')).toBeNull();
  });

  it('ends after a number of occurrences, counted from the first real one', () => {
    const three = rule({ startDate: '2026-01-20', monthDay: 1, count: 3 });
    expect(occurrencesBetween(three, '2026-01-01', '2026-12-31')).toEqual([
      '2026-02-01',
      '2026-03-01',
      '2026-04-01',
    ]);
    expect(nextOccurrence(three, '2026-04-01')).toBeNull();
  });

  it('finds the next occurrence far from the start without walking every day', () => {
    const daily = rule({ frequency: 'daily', startDate: '2000-01-01' });
    expect(nextOccurrence(daily, '2026-11-09')).toBe('2026-11-10');
    const monthly = rule({ startDate: '2000-01-31' });
    expect(nextOccurrence(monthly, '2026-02-01')).toBe('2026-02-28');
  });

  it('never yields a date before the requested day', () => {
    expect(nextOccurrence(rule({}), '2025-06-01')).toBe('2026-01-31');
    expect(gridDate(rule({}), 1)).toBe('2026-02-28');
  });

  it('reads an old "recurring" flag as every month on the due day', () => {
    const legacy = monthlyRuleFrom('2026-03-31');
    expect(nextOccurrence(legacy, '2026-03-31')).toBe('2026-04-30');
    expect(nextOccurrence(legacy, '2026-04-30')).toBe('2026-05-31');
  });
});

describe('shifting off non-working days', () => {
  // 2026-05-01 is a Friday holiday; the 2nd and 3rd are a weekend.
  const holidays = new Set(['2026-05-01']);

  it('leaves the day alone without a shift', () => {
    expect(shiftOffNonWorkingDays('2026-05-02', 'none', holidays)).toBe('2026-05-02');
    expect(shiftOffNonWorkingDays('2026-05-02', undefined, holidays)).toBe('2026-05-02');
  });

  it('moves a weekend day to the Monday after or the Friday before', () => {
    expect(shiftOffNonWorkingDays('2026-05-09', 'next')).toBe('2026-05-11');
    expect(shiftOffNonWorkingDays('2026-05-10', 'previous')).toBe('2026-05-08');
  });

  it('moves past a holiday next to a weekend', () => {
    expect(shiftOffNonWorkingDays('2026-05-01', 'next', holidays)).toBe('2026-05-04');
    expect(shiftOffNonWorkingDays('2026-05-03', 'previous', holidays)).toBe('2026-04-30');
  });

  it('keeps a working day', () => {
    expect(shiftOffNonWorkingDays('2026-05-05', 'next', holidays)).toBe('2026-05-05');
  });

  it('lists the years a span covers, for the holiday lookup', () => {
    expect(yearsBetween('2026-12-01', '2027-02-01')).toEqual([2026, 2027]);
  });
});
