import { bankForChart } from '@/modules/datev/datev-bank';

describe('bankForChart', () => {
  it("drops the other chart's bank, so the chart's own bank applies", () => {
    // 1200 is the bank in SKR 03 and receivables in SKR 04.
    expect(bankForChart('1200', '04')).toBeNull();
    // 1800 is the bank in SKR 04 and private withdrawals in SKR 03.
    expect(bankForChart('1800', '03')).toBeNull();
  });

  it("keeps a bank account of one's own, and the chart's own bank", () => {
    expect(bankForChart('1210', '04')).toBe('1210');
    expect(bankForChart('1200', '03')).toBe('1200');
  });
});
