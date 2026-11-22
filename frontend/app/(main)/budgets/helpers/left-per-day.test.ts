import { describe, expect, it } from 'vitest';
import content from '../budgets.content';
import { dayKeyIn, leftPerDay, pluralForm } from './left-per-day';

const MAY = { periodStart: '2026-05-01', periodEnd: '2026-05-31' };

describe('leftPerDay', () => {
  it('leaves the whole rest for the last day of the period', () => {
    expect(leftPerDay({ remaining: 40, currency: 'USD', ...MAY, today: '2026-05-31' })).toEqual({
      amount: 40,
      days: 1,
      fractionDigits: 2,
    });
  });

  it('counts every day of the period on its first day, today included', () => {
    expect(leftPerDay({ remaining: 310, currency: 'USD', ...MAY, today: '2026-05-01' })).toEqual({
      amount: 10,
      days: 31,
      fractionDigits: 2,
    });
  });

  it('counts across a month boundary inside a weekly period', () => {
    const week = { periodStart: '2026-04-27', periodEnd: '2026-05-03' };

    expect(leftPerDay({ remaining: 100, currency: 'EUR', ...week, today: '2026-04-30' })).toEqual(
      { amount: 25, days: 4, fractionDigits: 2 },
    );
  });

  it('knows February of a leap year has 29 days', () => {
    const february = { periodStart: '2028-02-01', periodEnd: '2028-02-29' };

    expect(
      leftPerDay({ remaining: 50, currency: 'USD', ...february, today: '2028-02-28' })?.days,
    ).toBe(2);
    expect(
      leftPerDay({ remaining: 290, currency: 'USD', ...february, today: '2028-02-01' })?.days,
    ).toBe(29);
  });

  it('ends at a period end the server sends, not at the calendar month', () => {
    const cutShort = { periodStart: '2026-05-01', periodEnd: '2026-05-20' };

    expect(
      leftPerDay({ remaining: 60, currency: 'USD', ...cutShort, today: '2026-05-15' })?.days,
    ).toBe(6);
  });

  it('says nothing when the budget is overspent', () => {
    expect(leftPerDay({ remaining: -12.5, currency: 'USD', ...MAY, today: '2026-05-10' })).toBe(
      null,
    );
  });

  it('says nothing when exactly nothing is left', () => {
    expect(leftPerDay({ remaining: 0, currency: 'USD', ...MAY, today: '2026-05-10' })).toBe(null);
    // Floating-point dust from available minus spent is still nothing.
    expect(
      leftPerDay({ remaining: 0.1 + 0.2 - 0.3, currency: 'USD', ...MAY, today: '2026-05-10' }),
    ).toBe(null);
  });

  it('says nothing when less than a cent a day is left', () => {
    expect(leftPerDay({ remaining: 0.05, currency: 'USD', ...MAY, today: '2026-05-10' })).toBe(
      null,
    );
  });

  it('says nothing for a past or a future period', () => {
    expect(leftPerDay({ remaining: 100, currency: 'USD', ...MAY, today: '2026-06-01' })).toBe(null);
    expect(leftPerDay({ remaining: 100, currency: 'USD', ...MAY, today: '2026-04-30' })).toBe(null);
  });

  it('says nothing when the budget has no period now (its window is closed)', () => {
    expect(
      leftPerDay({
        remaining: 100,
        currency: 'USD',
        periodStart: null,
        periodEnd: null,
        today: '2026-05-10',
      }),
    ).toBe(null);
  });

  it('rounds down to the currency smallest unit', () => {
    expect(leftPerDay({ remaining: 100, currency: 'USD', ...MAY, today: '2026-05-29' })).toEqual({
      amount: 33.33,
      days: 3,
      fractionDigits: 2,
    });
    // Yen has no minor unit, the Kuwaiti dinar has three.
    expect(leftPerDay({ remaining: 1000, currency: 'JPY', ...MAY, today: '2026-05-29' })).toEqual({
      amount: 333,
      days: 3,
      fractionDigits: 0,
    });
    expect(leftPerDay({ remaining: 10, currency: 'KWD', ...MAY, today: '2026-05-29' })).toEqual({
      amount: 3.333,
      days: 3,
      fractionDigits: 3,
    });
  });

  it('never promises more than is left over the days left', () => {
    for (const currency of ['USD', 'JPY', 'KWD']) {
      const scale = currency === 'JPY' ? 1 : currency === 'KWD' ? 1000 : 100;
      for (let cents = 1; cents < 5000; cents += 113) {
        const remaining = (cents * 7.13) / 100;
        for (let day = 1; day <= 31; day += 1) {
          const today = `2026-05-${String(day).padStart(2, '0')}`;
          const result = leftPerDay({ remaining, currency, ...MAY, today });
          if (result) {
            const promised = Math.round(result.amount * scale) * result.days;
            expect(promised).toBeLessThanOrEqual(Math.round(remaining * scale));
          }
        }
      }
    }
  });
});

describe('dayKeyIn', () => {
  it('is already tomorrow just after midnight east of Greenwich', () => {
    // 22:30 in London's winter is 07:30 the next day in Tokyo.
    const instant = new Date('2026-03-31T22:30:00Z');

    expect(dayKeyIn(instant, 'UTC')).toBe('2026-03-31');
    expect(dayKeyIn(instant, 'Asia/Tokyo')).toBe('2026-04-01');
    // So in Tokyo the March period is over and April's 30 days begin.
    const march = { periodStart: '2026-03-01', periodEnd: '2026-03-31' };
    const april = { periodStart: '2026-04-01', periodEnd: '2026-04-30' };
    const today = dayKeyIn(instant, 'Asia/Tokyo');
    expect(leftPerDay({ remaining: 300, currency: 'USD', ...march, today })).toBe(null);
    expect(leftPerDay({ remaining: 300, currency: 'USD', ...april, today })?.days).toBe(30);
  });
});

describe('pluralForm', () => {
  it('picks the form each language needs for a count of days', () => {
    expect(pluralForm('en', 1)).toBe('one');
    expect(pluralForm('en', 5)).toBe('many');
    expect(pluralForm('ru', 21)).toBe('one');
    expect(pluralForm('ru', 3)).toBe('few');
    expect(pluralForm('ru', 11)).toBe('many');
    // The dual: Slovenian "2 dneva", Upper Sorbian "2 dnjej", not the few form.
    expect(pluralForm('sl', 2)).toBe('two');
    expect(pluralForm('hsb', 2)).toBe('two');
    expect(pluralForm('sl', 3)).toBe('few');
    expect(pluralForm('ru', 2)).toBe('few');
  });

  it('has a dual text where the language has one, and the few text elsewhere', () => {
    const { leftPerDayTwo, leftPerDayFew } = content.content;
    const two = leftPerDayTwo.translation;
    expect(two.sl).toContain('{{count}} dneva');
    expect(two.hsb).toContain('{{count}} dnjej');
    expect(two.ru).toBe(leftPerDayFew.translation.ru);
    expect(pluralForm('zh', 1)).toBe('many');
  });
});
