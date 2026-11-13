import { describe, expect, it } from 'vitest';
import type { PayPeriodContext } from '@/app/lib/contracts';
import { periodBounds, periodOf, shiftMonth } from '@/app/lib/contracts/workspaces/pay-period';
import { currentMonthKey, monthEndOrToday } from './month-end';

const day = (value: number): PayPeriodContext => ({ monthStart: { kind: 'day', day: value } });

describe('month end under the workspace month rule', () => {
  it('keeps the calendar month without a rule', () => {
    const now = new Date(2026, 10, 9, 12);
    expect(currentMonthKey(now)).toBe('2026-11');
    expect(monthEndOrToday('2026-11', now)).toBeNull();
    expect(monthEndOrToday('2026-10', now)).toBe('2026-10-31');
    expect(monthEndOrToday('2028-02', now)).toBe('2028-02-29');
  });

  it('names the present period by the rule', () => {
    expect(currentMonthKey(new Date(2026, 10, 9, 12), day(15))).toBe('2026-10');
    expect(currentMonthKey(new Date(2026, 10, 15, 12), day(15))).toBe('2026-11');
    expect(currentMonthKey(new Date(2026, 10, 24, 12), day(25))).toBe('2026-11');
    expect(currentMonthKey(new Date(2026, 10, 28, 12), day(25))).toBe('2026-12');
    expect(currentMonthKey(new Date(2026, 11, 26, 12), day(25))).toBe('2027-01');
  });

  it('measures another month on the last day of the period of that name', () => {
    const now = new Date(2026, 10, 28, 12);
    expect(monthEndOrToday('2026-12', now, day(25))).toBeNull();
    // Day 25: "December" runs 25 Nov – 24 Dec, so not 31 December (in "January").
    expect(monthEndOrToday('2027-01', now, day(25))).toBe('2027-01-24');
    expect(monthEndOrToday('2026-11', now, day(25))).toBe('2026-11-24');
    expect(monthEndOrToday('2026-10', now, day(15))).toBe('2026-11-14');
  });

  it('lands every measured day in the period it measures', () => {
    const now = new Date(2026, 10, 28, 12);
    const rules: PayPeriodContext[] = [
      day(1),
      day(15),
      day(16),
      day(25),
      day(31),
      { monthStart: { kind: 'last_day' } },
      { monthStart: { kind: 'last_business_day' } },
    ];
    for (const rule of rules) {
      for (let offset = -14; offset <= 2; offset += 1) {
        const month = shiftMonth('2026-11', offset);
        const measured = monthEndOrToday(month, now, rule);
        if (measured) {
          expect(periodOf(rule, measured)).toBe(month);
          expect(measured).toBe(periodBounds(rule, month).to);
        }
      }
    }
  });
});
