import { withSidesByBalance } from '@/modules/parsing/helpers/pdf-layout-swapped-sides.helper';
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
