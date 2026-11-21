import type { PdfTextRow } from '@/common/utils/pdf-parser.util';
import { withCreditMarks } from '@/modules/parsing/helpers/pdf-layout-credit-marks.helper';
import type { LayoutTransaction } from '@/modules/parsing/helpers/pdf-layout-table.helper';

const line = (y: number, text: string): PdfTextRow => ({ page: 1, y, text, items: [] });
const read = (y: number, amount: number, balance: number): LayoutTransaction => ({
  date: { day: 4, month: 7 },
  dateText: '04 Jul',
  description: 'ACME',
  firstLine: 'ACME',
  counterparty: '',
  amount,
  balance,
  at: { page: 1, y },
});

describe('withCreditMarks', () => {
  it('reads an unmarked figure as a debit where the column marks money in "Cr"', () => {
    const rows = [
      line(10, '04 Jul POS Purchase ACME 400000*1000 01 Jul 206.69 3,193.31Cr'),
      line(20, '07 Jul FNB App Payment From Member 2,500.00 Cr 51.14'),
    ];
    const marked = withCreditMarks(rows, [read(10, 206.69, 3193.31), read(20, 2500, 51.14)]);
    expect(marked.map(row => [row.amount, row.balance])).toEqual([
      [-206.69, 3193.31],
      [2500, -51.14],
    ]);
  });

  it('leaves a statement that marks both sides, or neither, as read', () => {
    const both = [line(10, 'ACME 10.00 Dr 90.00 Cr'), line(20, 'ACME 5.00 Cr 95.00 Cr')];
    const rows = [read(10, -10, 90), read(20, 5, 95)];
    expect(withCreditMarks(both, rows)).toEqual(rows);
    expect(withCreditMarks([line(10, 'ACME 10.00 90.00')], [read(10, 10, 90)])).toEqual([read(10, 10, 90)]);
  });
});
