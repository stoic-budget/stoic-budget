import type { LayoutTransaction } from '@/modules/parsing/helpers/pdf-layout-table.helper';
import { closingBalanceFromRows, openingBalanceFromRows } from '@/modules/parsing/helpers/pdf-layout-transactions.helper';
import { parseDateParts } from '@/modules/parsing/helpers/statement-date.helper';

const read = (dateText: string, money: { debit?: number; credit?: number }, balance: number): LayoutTransaction => ({
  // As the reader leaves it: day first until the statement's order is known.
  date: parseDateParts(dateText, 'dmy') ?? parseDateParts(dateText, 'mdy') ?? { day: 1, month: 1 },
  dateText,
  description: 'Row',
  firstLine: 'Row',
  counterparty: '',
  ...money,
  balance,
  at: { page: 1, y: 0 },
});

describe('balances from rows listed newest first', () => {
  // "6/11/2021" reads as 6 November day first: only month first is it the oldest row.
  const rows = [
    read('6/25/2021', { credit: 19.23 }, 1972.97),
    read('6/18/2021', { debit: 149.99 }, 1953.74),
    read('6/11/2021', { credit: 19.23 }, 2103.73),
    read('6/11/2021', { debit: 50 }, 2084.5),
    read('6/11/2021', { debit: 10 }, 2134.5),
  ];

  it('reads the days in the statement\'s own order', () => {
    expect(openingBalanceFromRows(rows, 'mdy')).toBe(2144.5);
    expect(closingBalanceFromRows(rows, 'mdy')).toBe(1972.97);
  });
});
