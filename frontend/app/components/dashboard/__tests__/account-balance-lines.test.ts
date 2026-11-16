import { describe, expect, it } from 'vitest';
import type { WalletBalanceDays } from '@/app/lib/contracts';
import {
  balanceLines,
  balanceRows,
  latestBalances,
  OTHER_LINE,
  todayKey,
} from '../account-balance-lines';

const OTHER = 'Other';
const DATES = ['2026-07-01', '2026-07-02', '2026-07-03'];

/** Accounts holding `balance` every day; the name is the id. */
function balancesOf(accounts: Record<string, number>): WalletBalanceDays {
  return {
    currency: 'EUR',
    accounts: Object.keys(accounts).map(id => ({ id, name: id, type: 'checking', currency: 'EUR' })),
    days: DATES.map(date => ({ date, balances: { ...accounts } })),
    unconverted: [],
  };
}

describe('balanceLines', () => {
  it('draws up to five accounts on their own, the biggest (or most owed) first', () => {
    const lines = balanceLines(
      balancesOf({ 'Cash': 300, 'Card One': -900, 'Everyday Account': 500 }),
      '2026-07-03',
      OTHER,
    );

    expect(lines.map(line => line.key)).toEqual(['Card One', 'Everyday Account', 'Cash']);
    expect(lines.some(line => line.isOther)).toBe(false);
  });

  it('sums the smaller accounts past four into one Other line', () => {
    const accounts = { A: 600, B: 500, C: 400, D: 300, E: 20, F: 10 };

    const lines = balanceLines(balancesOf(accounts), '2026-07-03', OTHER);

    expect(lines.map(line => line.key)).toEqual(['A', 'B', 'C', 'D', OTHER_LINE]);
    expect(lines.at(-1)).toMatchObject({ name: OTHER, isOther: true, accountIds: ['E', 'F'] });
  });
});

describe('balanceRows', () => {
  const cash = { key: 'cash', name: 'Cash', isOther: false, accountIds: ['cash'] };
  const other = { key: OTHER_LINE, name: OTHER, isOther: true, accountIds: ['a', 'b'] };

  it('ends every line today', () => {
    const rows = balanceRows(balancesOf({ cash: 40 }).days, [cash], '2026-07-02');

    expect(rows.map(row => row.cash)).toEqual([40, 40, null]);
  });

  it('adds up what the shared line has, and leaves a day with nothing empty', () => {
    const days = [
      { date: '2026-07-01', balances: { a: 10, b: 5 } },
      { date: '2026-07-02', balances: { a: 10, b: null } },
      { date: '2026-07-03', balances: { a: null, b: null } },
    ];

    expect(balanceRows(days, [other], '2026-07-03').map(row => row[OTHER_LINE])).toEqual([
      15,
      10,
      null,
    ]);
  });
});

describe('latestBalances', () => {
  it("takes each line's last day that has a balance", () => {
    const cash = { key: 'cash', name: 'Cash', isOther: false, accountIds: ['cash'] };
    const rows = [
      { date: '2026-07-01', cash: 40 },
      { date: '2026-07-02', cash: 25 },
      { date: '2026-07-03', cash: null },
    ];

    expect(latestBalances(rows, [cash]).get('cash')).toBe(25);
  });
});

describe('todayKey', () => {
  it("reads the reader's own calendar day", () => {
    expect(todayKey(new Date(2026, 6, 2, 23, 30))).toBe('2026-07-02');
  });
});
