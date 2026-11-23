import { bankAfterChartChange } from '@/modules/datev/datev-bank';

describe('bankAfterChartChange', () => {
  it("drops the old chart's bank, so the new chart's bank applies", () => {
    // 1200 is the bank in SKR 03 and receivables in SKR 04.
    expect(bankAfterChartChange('1200', '03', '04')).toBeNull();
    // 1800 is the bank in SKR 04 and private withdrawals in SKR 03.
    expect(bankAfterChartChange('1800', '04', '03')).toBeNull();
  });

  it('keeps a bank account typed in by hand, and any bank while the chart stays', () => {
    expect(bankAfterChartChange('1210', '03', '04')).toBe('1210');
    expect(bankAfterChartChange('1200', '03', '03')).toBe('1200');
  });
});
