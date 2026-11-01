import {
  findDayRangePeriod,
  findHeaderPeriod,
  findLabelledPeriod,
  findMonthPeriod,
  findSharedYearPeriod,
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

describe('findSharedYearPeriod', () => {
  it('reads two ends that share the year printed at the end', () => {
    expect(findSharedYearPeriod('Jul 1 - Jul 31, 2023')).toEqual({
      from: new Date(Date.UTC(2023, 6, 1)),
      to: new Date(Date.UTC(2023, 6, 31)),
    });
    expect(findSharedYearPeriod('Jul 1 - 31, 2023')?.to).toEqual(new Date(Date.UTC(2023, 6, 31)));
  });

  it('starts a range across New Year in the year before', () => {
    expect(findSharedYearPeriod('Dec 15 - Jan 14, 2024')).toEqual({
      from: new Date(Date.UTC(2023, 11, 15)),
      to: new Date(Date.UTC(2024, 0, 14)),
    });
  });

  it.each(['Statement of account', 'Foo 1 - Foo 31, 2023', 'Feb 1 - Feb 30, 2023', 'Jul 20 - Jul 5, 2023'])(
    'is null for %s',
    text => {
      expect(findSharedYearPeriod(text)).toBeNull();
    },
  );
});

describe('findLabelledPeriod', () => {
  const header = [
    'Example Bank Limited 09/02/2020',
    '1 Example Street Branch: 1234 F rom Date: 10/01/2020',
    'Example Park To Date: 09/02/2020',
    'Print Date: 09/02/2020',
  ].join('\n');

  it('takes the date after each label, other text between them', () => {
    expect(findLabelledPeriod(header, 'dmy')).toEqual({
      from: new Date(2020, 0, 10),
      to: new Date(2020, 1, 9),
    });
  });

  it.each(['Print Date: 09/02/2020', 'From Date: 10/01/2020', 'From Date: 10/02/2020 To Date: 10/01/2020'])(
    'is null for %s',
    text => {
      expect(findLabelledPeriod(text, 'dmy')).toBeNull();
    },
  );

  it('is tried after the unlabelled forms', () => {
    expect(findHeaderPeriod('01/01/2020 - 31/01/2020', 'dmy')?.to).toEqual(new Date(2020, 0, 31));
    expect(findHeaderPeriod(header, 'dmy')?.from).toEqual(new Date(2020, 0, 10));
  });
});
