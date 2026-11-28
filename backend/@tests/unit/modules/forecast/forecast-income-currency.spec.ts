import { inCurrency } from '@/modules/forecast/forecast-transactions';

describe('inCurrency', () => {
  it("converts each payer's amount from its own currency at today's rate, to cents", async () => {
    const convert = vi.fn(async (amount: number, from: string) =>
      from === 'KZT' ? amount / 546.12 : amount,
    );

    const incomes = await inCurrency(
      [
        { label: 'ACME Corp', amount: 300_000, currency: 'KZT' },
        { label: 'Client Alpha', amount: 1200, currency: null },
      ],
      'EUR',
      convert,
    );

    expect(incomes).toEqual([
      expect.objectContaining({ label: 'ACME Corp', amount: 549.33, sourceId: 'income:0' }),
      expect.objectContaining({ label: 'Client Alpha', amount: 1200, sourceId: 'income:1' }),
    ]);
    // A payer with no currency of its own is in the workspace's.
    expect(convert).toHaveBeenCalledWith(1200, 'EUR');
  });
});
