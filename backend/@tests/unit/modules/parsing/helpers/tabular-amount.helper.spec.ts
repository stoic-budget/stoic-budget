import {
  amountSide,
  compactDate,
  tabularAmount,
} from '@/modules/parsing/helpers/tabular-amount.helper';

describe('tabularAmount', () => {
  it('reads the sign wherever the bank prints it', () => {
    expect(tabularAmount('$-12.00')).toBe(-12);
    expect(tabularAmount('USD -12.00')).toBe(-12);
    expect(tabularAmount('12.00 DR')).toBe(-12);
    expect(tabularAmount('12.00 CR')).toBe(12);
    expect(tabularAmount('1.500,00 (-)')).toBe(-1500);
  });

  it('still reads plain figures and cell numbers', () => {
    expect(tabularAmount('12')).toBe(12);
    expect(tabularAmount('-7')).toBe(-7);
    expect(tabularAmount(42.5)).toBe(42.5);
    expect(tabularAmount('')).toBeNull();
    expect(tabularAmount(null)).toBeNull();
  });
});

describe('amountSide', () => {
  it('names the side of an unsigned amount', () => {
    expect(amountSide('Af')).toBe('debit');
    expect(amountSide('Bij')).toBe('credit');
    expect(amountSide(' DR. ')).toBe('debit');
    expect(amountSide('Credit')).toBe('credit');
    expect(amountSide('Betaalautomaat')).toBeNull();
  });
});

describe('compactDate', () => {
  it('reads year-first digit runs and refuses impossible days', () => {
    const date = compactDate('20260302');
    expect(date && [date.getFullYear(), date.getMonth() + 1, date.getDate()]).toEqual([2026, 3, 2]);
    expect(compactDate('20260230')).toBeNull();
    expect(compactDate('2026032')).toBeNull();
  });
});
