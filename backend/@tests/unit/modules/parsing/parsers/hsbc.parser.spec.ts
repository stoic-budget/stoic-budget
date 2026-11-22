import type { PdfTextItem, PdfTextRow } from '@/common/utils/pdf-parser.util';
import { BankName, FileType } from '@/entities/statement.entity';
import { HsbcParser, isHsbcStatement, joinHsbcEntries } from '@/modules/parsing/parsers/hsbc.parser';

const STATEMENT = ['www.hsbc.co.uk', 'Your Statement', 'Date Pay m e nt t y p e and de t ails Paid o ut Paid in Balance'].join(
  '\n',
);

/** A word is [text, x]; width is 5pt per character. */
const line = (y: number, words: [string, number][]): PdfTextRow => {
  const items: PdfTextItem[] = words.map(([text, x]) => ({ text, x, y, width: text.length * 5, height: 8, page: 1 }));
  return { page: 1, y, text: words.map(([text]) => text).join(' '), items };
};

describe('HsbcParser', () => {
  it('knows its statement by its site and the table heading', () => {
    expect(isHsbcStatement(STATEMENT)).toBe(true);
    expect(isHsbcStatement('Paid to www.hsbc.co.uk')).toBe(false);
  });

  it('parses its files under its own bank or OTHER, and PDFs only', async () => {
    const parser = new HsbcParser();
    const claims = (bank: BankName, type = FileType.PDF) =>
      parser.canParse(bank, type, 'x.pdf', STATEMENT);
    await expect(claims(BankName.HSBC)).resolves.toBe(true);
    await expect(claims(BankName.OTHER)).resolves.toBe(true);
    await expect(claims(BankName.FIRST_DIRECT)).resolves.toBe(false);
    await expect(claims(BankName.HSBC, FileType.CSV)).resolves.toBe(false);
  });

  it("lays each entry out as one row: date and money on its first line, the day's date carried", () => {
    const rows = joinHsbcEntries([
      line(100, [['02', 40], ['Aug', 52], ['24', 72], ['DR', 120], ['ACME', 150]]),
      line(110, [['RBD02084', 150]]),
      line(120, [['ACME', 150], ['11,852.74', 300]]),
      line(130, [['DR', 120], ['ACME', 150]]),
      line(140, [['CHARGE', 150], ['17.00', 300], ['11,365.41', 450]]),
    ]);
    expect(rows.map(row => row.text)).toEqual([
      '02 Aug 24 DR ACME 11,852.74',
      'RBD02084',
      'ACME',
      '02 Aug 24 DR ACME 17.00 11,365.41',
      'CHARGE',
    ]);
  });
});
