import { describe, expect, it } from 'vitest';
import { switchChart } from './datev-chart';

const form = { chart: '03' as const, consultant: '1001', client: '2002', bank: '1200' };

describe('switchChart', () => {
  it("moves the bank to the new chart's bank when it was the old chart's", () => {
    expect(switchChart(form, '04')).toEqual({ ...form, chart: '04', bank: '1800' });
    expect(switchChart({ ...form, chart: '04', bank: '1800' }, '03').bank).toBe('1200');
  });

  it('keeps a bank account typed in by hand', () => {
    expect(switchChart({ ...form, bank: '1210' }, '04').bank).toBe('1210');
  });
});
