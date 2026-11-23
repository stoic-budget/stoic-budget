import { withEmptyDays } from '@/modules/dashboard/trend-days';

describe('withEmptyDays', () => {
  it('fills the days nothing was booked on with zeros', () => {
    const days = withEmptyDays(
      [
        { date: '2026-10-05', income: 0, expense: 1000 },
        { date: '2026-10-08', income: 0, expense: 1000 },
      ],
      new Date(2026, 9, 4),
      new Date(2026, 9, 8, 23, 59),
    );

    expect(days.map(day => [day.date, day.expense])).toEqual([
      ['2026-10-04', 0],
      ['2026-10-05', 1000],
      ['2026-10-06', 0],
      ['2026-10-07', 0],
      ['2026-10-08', 1000],
    ]);
  });
});
