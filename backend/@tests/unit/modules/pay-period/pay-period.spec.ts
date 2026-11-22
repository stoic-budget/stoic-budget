import {
  formatPeriodRange,
  isCalendarMonth,
  periodBounds,
  periodLength,
  periodOf,
  readMonthStart,
  shiftMonth,
} from '@/contracts';
import { PERIOD_OF_VECTORS, PERIOD_VECTORS } from '@/contracts/workspaces/pay-period-vectors';

describe('periodBounds (shared vectors)', () => {
  it.each(PERIOD_VECTORS.map(vector => [vector.name, vector] as const))('%s', (_name, vector) => {
    expect(periodBounds(vector.context, vector.month)).toEqual({
      from: vector.from,
      to: vector.to,
    });
  });
});

describe('periodOf (shared vectors)', () => {
  it.each(PERIOD_OF_VECTORS.map(vector => [vector.name, vector] as const))('%s', (_name, vector) => {
    expect(periodOf(vector.context, vector.date)).toBe(vector.month);
  });
});

describe('periods are contiguous', () => {
  const rules = [
    { kind: 'day', day: 1 },
    { kind: 'day', day: 15 },
    { kind: 'day', day: 29 },
    { kind: 'day', day: 31 },
    { kind: 'last_day' },
    { kind: 'last_business_day' },
  ] as const;

  it.each(rules.map(rule => [JSON.stringify(rule), rule] as const))(
    '%s leaves no gap and no overlap over two years',
    (_name, monthStart) => {
      const context = { monthStart };
      let key = '2027-01';
      let previous = periodBounds(context, '2026-12');
      for (let step = 0; step < 24; step += 1) {
        const bounds = periodBounds(context, key);
        const dayAfter = new Date(`${previous.to}T00:00:00Z`);
        dayAfter.setUTCDate(dayAfter.getUTCDate() + 1);
        expect(bounds.from).toBe(dayAfter.toISOString().slice(0, 10));
        expect(periodOf(context, bounds.from)).toBe(key);
        expect(periodOf(context, bounds.to)).toBe(key);
        previous = bounds;
        key = shiftMonth(key, 1);
      }
    },
  );
});

describe('readMonthStart', () => {
  it('reads every kind', () => {
    expect(readMonthStart({ kind: 'day', day: 15 })).toEqual({ kind: 'day', day: 15 });
    expect(readMonthStart({ kind: 'last_day' })).toEqual({ kind: 'last_day' });
    expect(readMonthStart({ kind: 'last_business_day' })).toEqual({ kind: 'last_business_day' });
    expect(readMonthStart({ kind: 'salary' })).toEqual({ kind: 'salary' });
  });

  it('falls back to day 1 for anything else', () => {
    for (const raw of [null, undefined, 'day', { kind: 'day', day: 0 }, { kind: 'day', day: 32 }, { kind: 'day', day: 1.5 }, { kind: 'weekly' }]) {
      expect(readMonthStart(raw)).toEqual({ kind: 'day', day: 1 });
    }
  });
});

describe('isCalendarMonth', () => {
  it('is true for day 1 and for a salary nobody detected', () => {
    expect(isCalendarMonth({ monthStart: { kind: 'day', day: 1 } })).toBe(true);
    expect(isCalendarMonth({ monthStart: { kind: 'salary' }, salary: null })).toBe(true);
    expect(isCalendarMonth({ monthStart: { kind: 'day', day: 2 } })).toBe(false);
    expect(isCalendarMonth({ monthStart: { kind: 'last_day' } })).toBe(false);
  });
});

describe('periodLength and formatPeriodRange', () => {
  it('counts both ends', () => {
    expect(periodLength({ from: '2026-10-15', to: '2026-11-14' })).toBe(31);
    expect(periodLength({ from: '2026-03-29', to: '2026-03-29' })).toBe(1);
  });

  it('formats a range in the reader language without moving a day', () => {
    const bounds = { from: '2026-10-15', to: '2026-11-14' };
    // ICU puts thin spaces around the dash; the words are what matter.
    expect(formatPeriodRange(bounds, 'en-GB').replace(/\s+/g, ' ')).toBe('15 Oct – 14 Nov');
    expect(formatPeriodRange(bounds, 'de')).toMatch(/15\..*Okt.*14\..*Nov/);
  });
});
