import {
  addDays,
  balanceAtEndOf,
  bookedLater,
  coverageEnd,
  type LaterRow,
  statementGaps,
} from '@/modules/wallets/balance-check-reasons';
import { balanceAdjustmentPayee } from '@/modules/wallets/balance-adjustment-translations';

const row = (id: string, date: string, amount: number): LaterRow => ({
  id,
  date,
  payee: 'ACME Store',
  amount,
});

describe('balanceAtEndOf', () => {
  const days = [
    { date: '2026-03-01', net: 50 },
    { date: '2026-03-05', net: -20.1 },
    { date: '2026-03-06', net: -9.9 },
  ];

  it('counts the opening and every day up to and including the one asked', () => {
    expect(balanceAtEndOf(100, days, '2026-03-05')).toBe(129.9);
  });

  it('is the opening balance before the first movement', () => {
    expect(balanceAtEndOf(100, days, '2026-02-28')).toBe(100);
  });

  it('rounds to the cent so float sums compare cleanly', () => {
    expect(balanceAtEndOf(0.1, [{ date: '2026-03-01', net: 0.2 }], '2026-03-01')).toBe(0.3);
  });
});

describe('addDays', () => {
  it('crosses the month and the year without a time zone shifting the day', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    // The night clocks go forward in Europe.
    expect(addDays('2026-03-29', 1)).toBe('2026-03-30');
  });
});

describe('bookedLater', () => {
  it('names the one row that is exactly the difference', () => {
    const rows = [row('a', '2026-03-06', -12), row('b', '2026-03-07', -40)];
    expect(bookedLater(rows, -40)).toEqual([rows[1]]);
  });

  it('names every row up to a day when together they are the difference', () => {
    const rows = [
      row('a', '2026-03-06', -12),
      row('b', '2026-03-06', -8),
      row('c', '2026-03-07', -5),
    ];
    expect(bookedLater(rows, -20)).toEqual([rows[0], rows[1]]);
    expect(bookedLater(rows, -25)).toEqual(rows);
  });

  it('does not stop in the middle of a day: half a day is not what the bank booked', () => {
    const rows = [row('a', '2026-03-06', -12), row('b', '2026-03-06', -8)];
    // -12 alone is a single-row match; -12 as a prefix only would split the day.
    expect(bookedLater(rows, -12)).toEqual([rows[0]]);
    const three = [row('a', '2026-03-06', -12), row('b', '2026-03-06', -8), row('c', '2026-03-06', -1)];
    expect(bookedLater(three, -20)).toBeNull();
  });

  it('says nothing about a near miss or when there is no difference', () => {
    const rows = [row('a', '2026-03-06', -12)];
    expect(bookedLater(rows, -12.02)).toBeNull();
    expect(bookedLater(rows, 0)).toBeNull();
    expect(bookedLater([], -12)).toBeNull();
  });

  it('matches across a weekend gap and with income as well as spending', () => {
    const rows = [row('salary', '2026-03-09', 1500)];
    expect(bookedLater(rows, 1500)).toEqual(rows);
  });
});

describe('statementGaps', () => {
  const jan = { from: '2026-01-01', to: '2026-01-31' };
  const feb = { from: '2026-02-01', to: '2026-02-28' };
  const apr = { from: '2026-04-01', to: '2026-04-30' };

  it('finds the month no statement covers', () => {
    expect(statementGaps([jan, feb, apr], '2026-04-30', false)).toEqual([
      { from: '2026-03-01', to: '2026-03-31' },
    ]);
  });

  it('sees no gap between back-to-back or overlapping statements, in any order', () => {
    expect(statementGaps([feb, jan], '2026-02-28', false)).toEqual([]);
    expect(
      statementGaps([jan, { from: '2026-01-15', to: '2026-02-10' }, feb], '2026-02-28', false),
    ).toEqual([]);
  });

  it('counts the stretch after the last statement only when nothing else was booked in it', () => {
    expect(statementGaps([jan], '2026-02-10', false)).toEqual([
      { from: '2026-02-01', to: '2026-02-10' },
    ]);
    expect(statementGaps([jan], '2026-02-10', true)).toEqual([]);
  });

  it('ignores statements that start after the day checked', () => {
    expect(statementGaps([jan, apr], '2026-01-31', false)).toEqual([]);
    expect(coverageEnd([jan, apr], '2026-01-31')).toBe('2026-01-31');
  });

  it('says nothing for an account with no statements', () => {
    expect(statementGaps([], '2026-01-31', false)).toEqual([]);
    expect(coverageEnd([], '2026-01-31')).toBeNull();
  });
});

describe('balanceAdjustmentPayee', () => {
  it('speaks the language of the person who booked it, English otherwise', () => {
    expect(balanceAdjustmentPayee('de')).toBe('Saldokorrektur');
    expect(balanceAdjustmentPayee('pt-BR')).toBe('Ajuste de saldo');
    expect(balanceAdjustmentPayee('xx')).toBe('Balance adjustment');
    expect(balanceAdjustmentPayee(null)).toBe('Balance adjustment');
  });
});
