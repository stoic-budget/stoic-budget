import { recheckedChecks } from '@/modules/parsing/helpers/statement-recheck.helper';
import type { ParseCheck } from '@/modules/parsing/interfaces/parsed-statement.interface';

const printedDebits = 1035.33;
const chain: ParseCheck = {
  code: 'balance_chain',
  passed: false,
  detail: { row: 4, date: '07 Sep', expected: 894520.53, actual: 894492.26 },
};
const totals: ParseCheck = {
  code: 'printed_totals',
  passed: false,
  detail: { side: 'debits', expected: printedDebits, actual: 611.96 },
};
const period: ParseCheck = { code: 'dates_in_period', passed: true };

describe('statement-recheck.helper', () => {
  it('holds a failed printed total against the new sum of its side', () => {
    const fixed = recheckedChecks([totals], { debits: printedDebits, credits: 0 }, false);
    expect(fixed).toEqual([{ ...totals, passed: true, detail: { ...totals.detail, actual: printedDebits } }]);
    const still = recheckedChecks([totals], { debits: 900, credits: 0 }, false);
    expect(still[0]).toMatchObject({ passed: false, detail: { actual: 900 } });
  });

  it('leaves the running balance to the balance equation once both balances are known', () => {
    expect(recheckedChecks([chain, period], { debits: 0, credits: 0 }, true)).toEqual([period]);
    // Without them nothing stands in for it: it stays for a person to confirm.
    expect(recheckedChecks([chain, period], { debits: 0, credits: 0 }, false)).toEqual([chain, period]);
  });
});
