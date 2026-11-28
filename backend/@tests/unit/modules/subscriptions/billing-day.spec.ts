import { billingDayAfter, billingDayOfCharges } from '@/common/utils/billing-day.util';
import { SubscriptionFrequency } from '@/entities/subscription.entity';
import { nextChargeAfter } from '@/modules/subscriptions/charge-calendar.util';

const day = (date: Date) => [date.getFullYear(), date.getMonth() + 1, date.getDate()];

describe('billing day (#662)', () => {
  it('returns to the 31st after a short month instead of drifting to the 28th', () => {
    const feb = nextChargeAfter(new Date(2026, 0, 31), SubscriptionFrequency.MONTHLY, 31);
    const mar = nextChargeAfter(feb, SubscriptionFrequency.MONTHLY, 31);
    const apr = nextChargeAfter(mar, SubscriptionFrequency.MONTHLY, 31);

    expect([day(feb), day(mar), day(apr)]).toEqual([
      [2026, 2, 28],
      [2026, 3, 31],
      [2026, 4, 30],
    ]);
  });

  it('brings a yearly 29 February back on the next leap year', () => {
    const next = nextChargeAfter(new Date(2027, 1, 28), SubscriptionFrequency.ANNUAL, 29);
    expect(day(next)).toEqual([2028, 2, 29]);
  });

  it('steps weekly charges by days, whatever the billing day', () => {
    const next = nextChargeAfter(new Date(2026, 0, 31), SubscriptionFrequency.WEEKLY, 31);
    expect(day(next)).toEqual([2026, 2, 7]);
  });

  it('keeps the billing day for a step and takes a date set by hand', () => {
    expect(billingDayAfter('2026-02-28', 31)).toBe(31);
    expect(billingDayAfter(new Date(2026, 3, 30), 31)).toBe(31);
    expect(billingDayAfter('2026-02-15', 31)).toBe(15);
    expect(billingDayAfter('2026-03-31', null)).toBe(31);
    expect(billingDayAfter(null, 12)).toBe(12);
  });
});

describe('billingDayOfCharges', () => {
  it('reads the 31st through a clamped month, and a mid-month day as it is', () => {
    const on = (y: number, m: number, d: number) => new Date(y, m - 1, d);
    expect(billingDayOfCharges([on(2026, 1, 31), on(2026, 2, 28), on(2026, 3, 31)])).toBe(31);
    expect(billingDayOfCharges([on(2026, 8, 31), on(2026, 9, 30)])).toBe(31);
    expect(billingDayOfCharges([on(2026, 1, 14), on(2026, 2, 16), on(2026, 3, 15)])).toBe(15);
    expect(billingDayOfCharges([])).toBeNull();
  });
});
