import { describe, expect, it } from 'vitest';
import {
  byAttention,
  type CoverageRow,
  coverageStatus,
  expectedThrough,
  STATEMENT_GRACE_DAYS,
} from '../data-coverage';

function row(overrides: Partial<CoverageRow>): CoverageRow {
  return {
    kind: 'account',
    walletId: 'w-everyday',
    name: 'Everyday Account',
    bankName: 'acme',
    accountTail: null,
    dataTo: '2026-10-31',
    pendingReview: 0,
    currency: 'EUR',
    reconciliation: null,
    ...overrides,
  };
}

const AFTER_GRACE = new Date(2026, 10, STATEMENT_GRACE_DAYS + 5);
const WITHIN_GRACE = new Date(2026, 10, STATEMENT_GRACE_DAYS - 2);

describe('expectedThrough', () => {
  it("asks for last month's end once a bank has had time to issue its statement", () => {
    expect(expectedThrough(AFTER_GRACE)).toBe('2026-10-31');
  });

  it('asks only for the month before in the first days of a month', () => {
    expect(expectedThrough(WITHIN_GRACE)).toBe('2026-09-30');
  });

  it('reaches back across a new year', () => {
    expect(expectedThrough(new Date(2027, 0, 20))).toBe('2026-12-31');
    expect(expectedThrough(new Date(2027, 0, 2))).toBe('2026-11-30');
  });
});

describe('coverageStatus', () => {
  const mismatch = {
    statementId: 'st-1',
    date: '2026-10-31',
    statementBalance: 120,
    computedBalance: 108,
    matches: false,
  };

  it('names the first month missing when the data stops short', () => {
    expect(coverageStatus(row({ dataTo: '2026-09-28' }), AFTER_GRACE)).toEqual({
      kind: 'behind',
      month: '2026-10',
    });
  });

  it("is not behind on last month's statement in the first days of a month", () => {
    expect(coverageStatus(row({ dataTo: '2026-09-30' }), WITHIN_GRACE).kind).toBe('ok');
  });

  it('puts behind before a balance that differs, and that before rows in Review', () => {
    const everything = row({ dataTo: '2026-09-28', reconciliation: mismatch, pendingReview: 3 });
    expect(coverageStatus(everything, AFTER_GRACE).kind).toBe('behind');
    expect(coverageStatus({ ...everything, dataTo: '2026-11-05' }, AFTER_GRACE)).toEqual({
      kind: 'differs',
      amount: mismatch.statementBalance - mismatch.computedBalance,
    });
    expect(coverageStatus(row({ pendingReview: 3 }), AFTER_GRACE)).toEqual({
      kind: 'waiting',
      count: 3,
    });
    expect(coverageStatus(row({}), AFTER_GRACE).kind).toBe('ok');
  });

  it('says nothing of a day it does not know', () => {
    expect(coverageStatus(row({ dataTo: null }), AFTER_GRACE).kind).toBe('ok');
  });
});

describe('byAttention', () => {
  it('lists what needs doing first, then by name', () => {
    const rows = [
      row({ walletId: 'b', name: 'Beta', pendingReview: 2 }),
      row({ walletId: 'c', name: 'Cash Box' }),
      row({ walletId: 'a', name: 'Alpha', dataTo: '2026-08-31' }),
    ];

    const names = byAttention(rows, AFTER_GRACE, item => item.name ?? '').map(
      ({ row: item }) => item.name,
    );

    expect(names).toEqual(['Alpha', 'Beta', 'Cash Box']);
  });
});
