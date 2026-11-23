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

  it('keeps the newest days when the window is longer than the cap', () => {
    const days = withEmptyDays(
      [{ date: '2026-11-22', income: 0, expense: 100 }],
      new Date(2020, 0, 1),
      new Date(2026, 10, 23),
    );

    expect(days.at(-1)?.date).toBe('2026-11-23');
    expect(days.find(day => day.date === '2026-11-22')?.expense).toBe(100);
  });
});
