import {
  findDayRangePeriod,
  findMonthPeriod,
} from '@/modules/parsing/helpers/statement-header-period.helper';

const day = (m: number, d: number) => new Date(Date.UTC(2022, m, d));

describe('findDayRangePeriod', () => {
  it('reads a day range in one month', () => {
    expect(findDayRangePeriod('01 -30 Sep 2022')).toEqual({ from: day(8, 1), to: day(8, 30) });
    expect(findDayRangePeriod('1 - 30 September 2022')).toEqual({ from: day(8, 1), to: day(8, 30) });
  });

  it('only counts the first range', () => {
    expect(findDayRangePeriod('01 -30 Sep 2022\n5 -10 Jan 2022')?.from).toEqual(day(8, 1));
  });

  it.each([
    ['no range', 'Statement of account'],
    ['days reversed', '30 -01 Sep 2022'],
    ['unknown month', '12-15 Foo 2022'],
    ['a day that is not in the month', '29-31 Feb 2022'],
  ])('is null for %s', (_name, text) => {
    expect(findDayRangePeriod(text)).toBeNull();
  });
});

describe('findMonthPeriod', () => {
  it('reads a whole month', () => {
    expect(findMonthPeriod('For month October 2021')).toEqual({
      from: new Date(Date.UTC(2021, 9, 1)),
      to: new Date(Date.UTC(2021, 9, 31)),
    });
    expect(findMonthPeriod('For month: Feb 2024')?.to).toEqual(new Date(Date.UTC(2024, 1, 29)));
  });

  it.each(['Statement of account', 'For month Foo 2021'])('is null for %s', text => {
    expect(findMonthPeriod(text)).toBeNull();
  });
});
