import type { PdfTextRow } from '@/common/utils/pdf-parser.util';
import { readBlocks, rowBlocks } from '@/modules/parsing/helpers/pdf-layout-blocks.helper';
import type { LayoutTransaction } from '@/modules/parsing/helpers/pdf-layout-table.helper';

const line = (page: number, y: number, text: string): PdfTextRow => ({
  page,
  y,
  text,
  items: [{ text, x: 40, y, width: text.length * 4, height: 8, page }],
});

const row = (page: number, y: number): LayoutTransaction => ({
  date: { day: 1, month: 3 },
  dateText: '1.3.',
  description: '',
  firstLine: '',
  counterparty: '',
  amount: 1,
  at: { page, y },
});

const texts = (blocks: PdfTextRow[][]) => blocks.map(block => block.map(entry => entry.text));

describe('rowBlocks', () => {
  it("gives each row its lines, up to the next row's", () => {
    const rows = [line(1, 100, 'first'), line(1, 110, 'under first'), line(1, 120, 'second'), line(1, 130, 'under second')];
    expect(texts(rowBlocks(rows, [row(1, 100), row(1, 120)]))).toEqual([
      ['first', 'under first'],
      ['second', 'under second'],
    ]);
  });

  it("ends a row's lines at the first gap: a footer or a note after the table is not its", () => {
    const rows = [
      line(1, 100, 'last row'),
      line(1, 110, 'its message'),
      line(1, 780, 'Zapsáno v OR'),
      line(2, 30, 'page header'),
      line(2, 100, 'next row'),
      line(2, 160, 'Přehled poplatků'),
    ];
    expect(texts(rowBlocks(rows, [row(1, 100), row(2, 100)]))).toEqual([
      ['last row', 'its message'],
      ['next row'],
    ]);
  });

  it('gives a row read without its position no lines', () => {
    expect(rowBlocks([line(1, 100, 'x')], [{ ...row(1, 100), at: undefined }])).toEqual([[]]);
  });
});

describe('readBlocks', () => {
  const isFirst = (entry: PdfTextRow) => entry.text.endsWith('CZK');
  const isHeader = (entry: PdfTextRow) => /^(?:Strana|Datum)/.test(entry.text);

  it('goes on with a block cut by the page break, past the next page header', () => {
    const rows = [
      line(1, 100, '2.3.2026 Platba -1,00 CZK'),
      line(1, 770, '9.3.2026 Platba kartou -75,30 CZK'),
      line(1, 790, 'Strana 1/2'),
      line(2, 30, 'Strana 2/2'),
      line(2, 60, 'Datum Kategorie'),
      line(2, 100, '8436778002 PK: 516844XXXXXX4400'),
      line(2, 110, 'ACME FUEL; Svit; SVK'),
    ];
    const reading = readBlocks(rows, isFirst, isHeader);
    const read = [row(1, 100), row(1, 770)];
    expect(texts(reading.blocks(read))).toEqual([
      ['2.3.2026 Platba -1,00 CZK'],
      ['9.3.2026 Platba kartou -75,30 CZK', '8436778002 PK: 516844XXXXXX4400', 'ACME FUEL; Svit; SVK'],
    ]);
  });

  it('ends a block at a gap on the same page', () => {
    const rows = [line(1, 100, '2.3.2026 Platba -1,00 CZK'), line(1, 160, 'Přehled poplatků')];
    expect(texts(readBlocks(rows, isFirst, isHeader).blocks([row(1, 100)]))).toEqual([['2.3.2026 Platba -1,00 CZK']]);
  });
});

