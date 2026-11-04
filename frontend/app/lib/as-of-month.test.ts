import { describe, expect, it } from 'vitest';
import { currentMonthKey } from '@/app/components/dashboard/month-end';
import { readAsOf, withAsOf } from './as-of-month';

const PAST = '2020-10';

describe('as-of month links', () => {
  it('reads a valid month other than the current one, and nothing else', () => {
    expect(readAsOf(PAST)).toBe(PAST);
    expect(readAsOf(currentMonthKey())).toBeNull();
    expect(readAsOf('2020-13')).toBeNull();
    expect(readAsOf('october')).toBeNull();
    expect(readAsOf(null)).toBeNull();
  });

  it('marks a link with the month, after its own query and before its hash', () => {
    expect(withAsOf('/budgets', PAST)).toBe(`/budgets?asOf=${PAST}`);
    expect(withAsOf(`/budgets?month=${PAST}#budget-list`, PAST)).toBe(
      `/budgets?month=${PAST}&asOf=${PAST}#budget-list`,
    );
  });

  it('leaves a link to the current month as it is', () => {
    expect(withAsOf('/budgets', currentMonthKey())).toBe('/budgets');
  });
});
