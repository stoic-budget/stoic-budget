import type { PdfTextItem, PdfTextRow } from '@/common/utils/pdf-parser.util';
import { BankName, FileType } from '@/entities/statement.entity';
import { IbcParser, isIbcStatement, readIbcRows } from '@/modules/parsing/parsers/ibc.parser';

const STATEMENT = ['Visit us Online: www.IBC.com', 'IBC Free Checking Account Recap Account Number: 1000'].join('\n');

const line = (y: number, words: string[]): PdfTextRow => {
  const items: PdfTextItem[] = words.map((text, index) => ({ text, x: index * 60, y, width: 50, height: 8, page: 1 }));
  return { page: 1, y, text: words.join(' '), items };
};

describe('IbcParser', () => {
  it('knows its statement by the site and the account recap', () => {
    expect(isIbcStatement(STATEMENT)).toBe(true);
    expect(isIbcStatement('Transfer from IBC')).toBe(false);
  });

  it('parses its files under its own bank or OTHER, and PDFs only', async () => {
    const parser = new IbcParser();
    const claims = (bank: BankName, type = FileType.PDF) =>
      parser.canParse(bank, type, 'x.pdf', STATEMENT);
    await expect(claims(BankName.IBC)).resolves.toBe(true);
    await expect(claims(BankName.OTHER)).resolves.toBe(true);
    await expect(claims(BankName.FROST)).resolves.toBe(false);
    await expect(claims(BankName.IBC, FileType.CSV)).resolves.toBe(false);
  });

  it('reads the deposit and check grids and the electronic lists, without the barcode', () => {
    const rows = readIbcRows([
      line(10, ['Deposits', '(Credits)']),
      line(20, ['11/12', '1,439.00', '11/19', '1,000.00']),
      line(30, ['Checks', '(Debits)']),
      line(40, ['111000111101000001000011', '11/22', '1681', '75.00', '11/01', '1726*', '50.00']),
      line(50, ['Debits']),
      line(60, ['11/08', 'ATM', 'Withdrawal', 'SAMPLETOWN', 'OK', '60.00']),
      line(70, ['Daily', 'Ending', 'Balance']),
      line(80, ['10/29', '4,843.54']),
    ]);
    expect(rows.map(row => [row.dateText, row.description, row.credit, row.debit])).toEqual([
      ['11/12', 'DEPOSIT', 1439, undefined],
      ['11/19', 'DEPOSIT', 1000, undefined],
      ['11/22', 'CHECK 1681', undefined, 75],
      ['11/01', 'CHECK 1726', undefined, 50],
      ['11/08', 'ATM Withdrawal SAMPLETOWN OK', undefined, 60],
    ]);
  });
});
