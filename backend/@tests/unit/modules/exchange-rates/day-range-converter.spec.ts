import { loadDayRangeConverter } from '@/modules/exchange-rates/day-converter';

describe('loadDayRangeConverter (#598)', () => {
  it('reads one rate curve per currency and fills each day from the latest quote on or before it', async () => {
    const getRateCurve = vi.fn(async (from: string) =>
      from === 'USD'
        ? [
            { date: '2025-01-01', rate: 0.9 },
            { date: '2025-03-01', rate: 0.8 },
          ]
        : [],
    );
    const days = ['2025-01-15', '2025-02-20', '2025-03-10'];
    const rows = [
      ...days.map(day => ({ currency: 'USD', day })),
      { currency: 'XAU', day: '2025-02-20' },
    ];

    const convert = await loadDayRangeConverter({ getRateCurve } as never, 'EUR', rows, 'ws-1');

    expect(days.map(day => convert(100, 'USD', day))).toEqual([90, 90, 80]);
    expect(convert(5, 'XAU', '2025-02-20')).toBe(0);
    expect(convert.missing).toEqual(['XAU']);
    // One curve per foreign currency, over the whole range, not one lookup per day.
    expect(getRateCurve).toHaveBeenCalledTimes(2);
    expect(getRateCurve).toHaveBeenCalledWith('USD', 'EUR', '2025-01-15', '2025-03-10', 'ws-1');
  });
});
