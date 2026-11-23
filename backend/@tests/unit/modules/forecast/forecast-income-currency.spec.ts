import { incomeInCurrency } from '@/modules/forecast/forecast-transactions';

describe('incomeInCurrency', () => {
  const row = (amount: string, currency: string, day: string) => ({
    counterpartyName: 'ACME Employer',
    amount,
    currency,
    day,
    transactionDate: day,
  });

  it('converts income at its own day, and leaves out a currency with no rate', async () => {
    const rates = {
      getRateOrNull: vi.fn(async (from: string, to: string, date?: string) =>
        from === 'USD' && to === 'EUR' ? (date === '2026-09-01' ? 0.9 : 0.8) : null,
      ),
    };

    const rows = await incomeInCurrency(
      rates as never,
      'EUR',
      [
        row('1000', 'USD', '2026-09-01'),
        row('1000', 'USD', '2026-10-01'),
        row('500', 'EUR', '2026-10-01'),
        row('700', 'XYZ', '2026-10-01'),
      ],
      'ws-1',
    );

    expect(rows.map(income => [income.currency, income.amount])).toEqual([
      ['USD', 900],
      ['USD', 800],
      ['EUR', 500],
    ]);
  });
});
