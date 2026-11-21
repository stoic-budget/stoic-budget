import { withSidesByBalance, withSidesFromBalances } from '@/modules/parsing/helpers/pdf-layout-swapped-sides.helper';
import type { LayoutTransaction } from '@/modules/parsing/helpers/pdf-layout-table.helper';

const read = (money: { debit?: number; credit?: number }, balance: number): LayoutTransaction => ({
  date: { day: 1, month: 1 },
  dateText: '01 Jan',
  description: 'ACME',
  firstLine: 'ACME',
  counterparty: '',
  ...money,
  balance,
});

describe('withSidesByBalance', () => {
  it('swaps the sides when the running balance follows the rows only that way', () => {
    const rows = [read({ credit: 20 }, 1403.95), read({ credit: 135.67 }, 1268.28), read({ debit: 250 }, 1518.28)];
    expect(withSidesByBalance(rows).map(row => [row.debit, row.credit])).toEqual([
      [20, undefined],
      [135.67, undefined],
      [undefined, 250],
    ]);
  });

  it('leaves rows whose balance follows them as read', () => {
    const rows = [read({ debit: 20 }, 80), read({ credit: 5 }, 85)];
    expect(withSidesByBalance(rows)).toBe(rows);
  });
});

describe('withSidesFromBalances', () => {
  const read = (amount: number, balance: number): LayoutTransaction => ({
    date: { day: 1, month: 8, year: 2024 },
    dateText: '01/08/2024',
    description: 'Transfer',
    firstLine: 'Transfer',
    counterparty: '',
    credit: amount,
    balance,
    at: { page: 1, y: 0 },
  });

  it('gives each row the side its running balance moved by, the first from the opening', () => {
    const rows = withSidesFromBalances([read(1000, 22101.68), read(1500, 23601.68), read(5, 99)], 23101.68);
    expect(rows.map(row => [row.debit, row.credit])).toEqual([
      [1000, undefined],
      [undefined, 1500],
      [undefined, 5],
    ]);
  });
});

describe('withSidesFromBalances on one unsigned amount column', () => {
  it('gives the amount the side its balance moved by', () => {
    const [row] = withSidesFromBalances(
      [
        {
          date: { day: 11, month: 10, year: 2021 },
          dateText: '11 Oct 2021',
          description: 'Withdrawal',
          firstLine: 'Withdrawal',
          counterparty: '',
          amount: 500,
          balance: 164.54,
          at: { page: 1, y: 0 },
        },
      ],
      664.54,
    );
    expect(row).toMatchObject({ debit: 500 });
    expect(row.amount).toBeUndefined();
  });
});
