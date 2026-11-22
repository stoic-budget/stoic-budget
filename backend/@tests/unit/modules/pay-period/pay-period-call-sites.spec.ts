import type { PayPeriodContext } from '@/contracts';
import { BudgetPeriodType } from '@/entities/budget.entity';
import { SubscriptionFrequency } from '@/entities/subscription.entity';
import {
  computeMonthRange,
  computePeriodRange,
  previousPeriods,
  resolveMonth,
} from '@/modules/budgets/budget-period.util';
import {
  daysInWindow,
  getMonthWindowBounds,
  parseMonthWindow,
} from '@/modules/dashboard/dashboard-window.util';
import {
  endOfMonth,
  monthBounds,
  monthKey,
  monthsBetween,
} from '@/modules/insights/analyzers/month-bounds';
import { monthsCovered } from '@/modules/reports/budget-variance.util';
import { splitMonthCharges } from '@/modules/subscriptions/charge-calendar.util';
import { isPastMonth, monthInView } from '@/modules/subscriptions/month-status-history';

/**
 * Every place that used to build a calendar month: with day 1 (or no rule) it
 * gives exactly the old answer, with day 15 the shifted one.
 */
const DAY_1: PayPeriodContext = { monthStart: { kind: 'day', day: 1 } };
const DAY_15: PayPeriodContext = { monthStart: { kind: 'day', day: 15 } };

/** 9 Nov 2026: before the 15th, so day 15 puts it in the month named October. */
const NOW = new Date(2026, 10, 9, 13, 30);
const local = (year: number, month: number, day: number) => new Date(year, month - 1, day);

describe('budgets: computePeriodRange / computeMonthRange / resolveMonth', () => {
  it('day 1 and no rule are the calendar month', () => {
    const calendar = { start: local(2026, 11, 1), end: local(2026, 11, 30) };
    expect(computePeriodRange(BudgetPeriodType.MONTHLY, NOW)).toEqual(calendar);
    expect(computePeriodRange(BudgetPeriodType.MONTHLY, NOW, DAY_1)).toEqual(calendar);
    expect(computeMonthRange(NOW, DAY_1)).toEqual(calendar);
    expect(resolveMonth('2026-11', NOW, DAY_1)).toEqual({
      key: '2026-11',
      anchor: local(2026, 11, 1),
      window: calendar,
    });
    expect(resolveMonth(undefined, NOW, DAY_1)).toEqual({ key: '2026-11', anchor: NOW, window: calendar });
  });

  it('day 15 shifts a monthly budget and leaves the other period types alone', () => {
    const shifted = { start: local(2026, 10, 15), end: local(2026, 11, 14) };
    expect(computePeriodRange(BudgetPeriodType.MONTHLY, NOW, DAY_15)).toEqual(shifted);
    expect(computeMonthRange(NOW, DAY_15)).toEqual(shifted);
    expect(computePeriodRange(BudgetPeriodType.QUARTERLY, NOW, DAY_15)).toEqual(
      computePeriodRange(BudgetPeriodType.QUARTERLY, NOW),
    );
    expect(resolveMonth(undefined, NOW, DAY_15)).toEqual({ key: '2026-10', anchor: NOW, window: shifted });
    expect(resolveMonth('2026-11', NOW, DAY_15).window).toEqual({
      start: local(2026, 11, 15),
      end: local(2026, 12, 14),
    });
  });

  it('rollover looks back over the shifted months', () => {
    const budget = { periodType: BudgetPeriodType.MONTHLY, startsOn: null, endsOn: null };
    const began = local(2026, 1, 1);
    expect(previousPeriods(budget, local(2026, 11, 1), began, 2)).toEqual([
      { start: local(2026, 9, 1), end: local(2026, 9, 30) },
      { start: local(2026, 10, 1), end: local(2026, 10, 31) },
    ]);
    expect(previousPeriods(budget, local(2026, 10, 15), began, 2, DAY_15)).toEqual([
      { start: local(2026, 8, 15), end: local(2026, 9, 14) },
      { start: local(2026, 9, 15), end: local(2026, 10, 14) },
    ]);
  });
});

describe('dashboard: month windows', () => {
  it('day 1 is the calendar month, whole days', () => {
    const window = getMonthWindowBounds(NOW, DAY_1);
    expect(window).toEqual(getMonthWindowBounds(NOW));
    expect(window.since).toEqual(local(2026, 11, 1));
    expect(window.endDate).toEqual(new Date(2026, 10, 30, 23, 59, 59, 999));
    expect(parseMonthWindow('2026-02', DAY_1)).toEqual(parseMonthWindow('2026-02'));
    expect(daysInWindow(window)).toBe(30);
  });

  it('day 15: the month containing a day, or the month a picked key names', () => {
    const containing = getMonthWindowBounds(NOW, DAY_15);
    expect(containing.since).toEqual(local(2026, 10, 15));
    expect(containing.endDate).toEqual(new Date(2026, 10, 14, 23, 59, 59, 999));
    // The picker sends the first day of the month it shows.
    const named = getMonthWindowBounds(local(2026, 11, 1), DAY_15, true);
    expect(named.since).toEqual(local(2026, 11, 15));
    expect(parseMonthWindow('2026-11', DAY_15)).toEqual(named);
    expect(daysInWindow(named)).toBe(30);
  });
});

describe('insights: month bounds', () => {
  it('day 1 keeps the calendar answers', () => {
    expect(monthBounds(NOW, 1, DAY_1)).toEqual({
      key: '2026-10',
      start: local(2026, 10, 1),
      end: local(2026, 10, 31),
    });
    expect(endOfMonth(NOW, DAY_1)).toEqual(local(2026, 12, 1));
    expect(monthKey(NOW)).toBe('2026-11');
    expect(monthsBetween(local(2026, 8, 31), NOW)).toBe(3);
  });

  it('day 15 shifts them', () => {
    expect(monthBounds(NOW, 1, DAY_15)).toEqual({
      key: '2026-09',
      start: local(2026, 9, 15),
      end: local(2026, 10, 14),
    });
    expect(endOfMonth(NOW, DAY_15)).toEqual(local(2026, 11, 15));
    expect(monthKey(NOW, DAY_15)).toBe('2026-10');
    // 31 Aug is in the month named August, 9 Nov in the one named October.
    expect(monthsBetween(local(2026, 8, 31), NOW, DAY_15)).toBe(2);
  });
});

describe('subscriptions: month status', () => {
  it('day 1 keeps the calendar month', () => {
    expect(isPastMonth('2026-10', NOW, DAY_1)).toBe(true);
    expect(monthInView(undefined, NOW, DAY_1)).toEqual({
      key: '2026-11',
      period: { start: local(2026, 11, 1), end: local(2026, 11, 30) },
      today: NOW,
    });
    expect(monthInView('2026-12', NOW).today).toEqual(local(2026, 12, 1));
  });

  it('day 15: October is still running on 9 November', () => {
    expect(isPastMonth('2026-10', NOW, DAY_15)).toBe(false);
    expect(isPastMonth('2026-09', NOW, DAY_15)).toBe(true);
    expect(monthInView(undefined, NOW, DAY_15)).toEqual({
      key: '2026-10',
      period: { start: local(2026, 10, 15), end: local(2026, 11, 14) },
      today: NOW,
    });
    expect(monthInView('2026-11', NOW, DAY_15).today).toEqual(local(2026, 11, 15));
  });

  it('splits charges inside the shifted month', () => {
    const today = local(2026, 11, 9);
    // Charged on the 20th: in November's calendar month it is still to come,
    // in the month of 15 Oct – 14 Nov it was paid on 20 Oct.
    expect(splitMonthCharges(local(2026, 11, 20), SubscriptionFrequency.MONTHLY, today)).toEqual({
      paid: 0,
      unpaid: 1,
    });
    const shifted = { start: local(2026, 10, 15), end: local(2026, 11, 14) };
    expect(
      splitMonthCharges(local(2026, 11, 20), SubscriptionFrequency.MONTHLY, today, shifted),
    ).toEqual({ paid: 1, unpaid: 0 });
  });
});

describe('reports: months a window covers', () => {
  it('day 1 counts calendar months', () => {
    expect(monthsCovered('2026-10-15', '2026-11-14')).toBeCloseTo(17 / 31 + 14 / 30);
    expect(monthsCovered('2026-10-15', '2026-11-14', DAY_1)).toBeCloseTo(17 / 31 + 14 / 30);
  });

  it('day 15 counts one whole shifted month as exactly 1', () => {
    expect(monthsCovered('2026-10-15', '2026-11-14', DAY_15)).toBe(1);
    expect(monthsCovered('2026-10-15', '2026-12-14', DAY_15)).toBe(2);
    expect(monthsCovered('2026-11-01', '2026-11-14', DAY_15)).toBeCloseTo(14 / 31);
  });
});
