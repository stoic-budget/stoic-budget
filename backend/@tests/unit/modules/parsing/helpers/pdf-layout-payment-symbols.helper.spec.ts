import type { PdfTextRow } from '@/common/utils/pdf-parser.util';
import {
  withoutTrailingWords,
  withPaymentSymbols,
} from '@/modules/parsing/helpers/pdf-layout-payment-symbols.helper';
import type { LayoutTransaction } from '@/modules/parsing/helpers/pdf-layout-table.helper';

function line(y: number, words: [number, string][]): PdfTextRow {
  return {
    page: 1,
    y,
    text: words.map(([, text]) => text).join(' '),
    items: words.map(([x, text]) => ({ text, x, y, width: text.length * 4, height: 8, page: 1 })),
  };
}

const row = (y: number, counterparty: string, description: string): LayoutTransaction => ({
  date: { day: 5, month: 3 },
  dateText: '05.03.',
  description,
  firstLine: description,
  counterparty,
  amount: 100,
  at: { page: 1, y },
});

const HEADER = [
  line(100, [[40, 'Datum'], [80, 'Označení'], [200, 'Protistrana'], [470, 'Částka']]),
  line(110, [[40, 'Valuta'], [80, 'Protiúčet'], [200, 'VS'], [260, 'KS'], [320, 'SS']]),
];

describe('withPaymentSymbols', () => {
  it("takes the figures under the symbol headings out of the payee and keeps the variable symbol", () => {
    const rows = [
      ...HEADER,
      line(130, [[40, '05.03.'], [80, 'Příchozí'], [200, 'ACME s.r.o.'], [470, '100,00']]),
      line(140, [[80, '2900000001/0800'], [200, '2026030'], [260, '0308']]),
      line(156, [[40, '07.03.'], [80, 'Platba'], [200, 'ACME Shop'], [470, '-5,00']]),
      line(166, [[80, '1100000004/0300'], [260, '0558']]),
    ];
    const [first, second] = withPaymentSymbols(rows, [
      row(130, 'ACME s.r.o. 2026030 0308', 'Příchozí 2900000001/0800'),
      row(156, 'ACME Shop 0558', 'Platba 1100000004/0300'),
    ]);
    expect(first).toMatchObject({ counterparty: 'ACME s.r.o.', documentNumber: '2026030' });
    // A constant symbol alone is no reference.
    expect(second.counterparty).toBe('ACME Shop');
    expect(second.documentNumber).toBeUndefined();
  });

  it('leaves the rows of a table without symbol headings as they are', () => {
    const read = [row(130, 'ACME 2026030', 'Platba')];
    const rows = [line(100, [[40, 'Date'], [200, 'Description']]), line(130, [[40, '05.03.'], [200, 'ACME 2026030']])];
    expect(withPaymentSymbols(rows, read)).toEqual(read);
  });

  it('does not take a row\'s own "VS: 555 KS: 0308" line for the header', () => {
    const read = [row(130, 'ACME 1234', 'Platba')];
    // Were that line a header, "1234" right under its "VS:" would be read as the symbol.
    const rows = [
      line(130, [[40, '05.03.'], [80, 'Platba'], [200, 'ACME']]),
      line(140, [[200, 'VS:'], [215, '555'], [260, 'KS:'], [275, '0308']]),
      line(150, [[200, '1234']]),
    ];
    expect(withPaymentSymbols(rows, read)).toEqual(read);
  });

  it("reads the symbols from the lines under the row, not the bank's id on its first line", () => {
    const stacked = [
      line(100, [[40, 'Datum'], [200, 'Protistrana'], [360, 'Identifikace']]),
      line(110, [[40, 'Valuta'], [300, 'KS'], [360, 'VS']]),
      line(130, [[40, '05.03.'], [200, 'ACME'], [360, '258'], [470, '100,00']]),
      line(140, [[300, '0308'], [360, '2026030']]),
    ];
    const [read] = withPaymentSymbols(stacked, [row(130, 'ACME 0308 2026030', 'Příchozí')]);
    expect(read).toMatchObject({ counterparty: 'ACME', documentNumber: '2026030' });
  });

  it('takes out the symbols printed after the name, not a figure of the name itself', () => {
    expect(withoutTrailingWords('ACME 1001 s.r.o. 1001', ['1001'])).toBe('ACME 1001 s.r.o.');
    expect(withoutTrailingWords('Byty 1001 s.r.o.', ['1001'])).toBe('Byty 1001 s.r.o.');
    expect(withoutTrailingWords('ACME 2026030 0308', ['2026030', '0308'])).toBe('ACME');
  });
});
