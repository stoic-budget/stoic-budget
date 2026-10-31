import { BankName, FileType } from '@/entities/statement.entity';
import type { PdfTextRow } from '@/common/utils/pdf-parser.util';
import {
  BendigoParser,
  bendigoPayee,
  bendigoPaymentType,
  isBendigoStatement,
} from '@/modules/parsing/parsers/bendigo.parser';

const STATEMENT = [
  'Your details at a glance',
  'BSB number 000-000',
  'Bendigo and Adelaide Bank Limited ABN 00 000 000 000',
].join('\n');

/** Columns: date 40, transaction 100, withdrawals 300, deposits 380, balance 460. */
const COLUMN_X = [40, 100, 300, 380, 460];

const row = (cells: Array<[number, string]>, y: number): PdfTextRow => ({
  text: cells.map(([, text]) => text).join(' '),
  y,
  page: 1,
  items: cells.map(([column, text]) => ({ text, x: COLUMN_X[column], width: 40 })),
});

class Probe extends BendigoParser {
  read(rows: PdfTextRow[]) {
    return this.readTransactions(rows);
  }
}

describe('BendigoParser', () => {
  it('knows its statement by the bank name and the account block', () => {
    expect(isBendigoStatement(STATEMENT)).toBe(true);
    expect(isBendigoStatement('www.bendigobank.com.au\nBSB number 000-000')).toBe(true);
    expect(isBendigoStatement('BSB number 000-000')).toBe(false);
    expect(isBendigoStatement('Transfer to Bendigo and Adelaide Bank Limited')).toBe(false);
  });

  it('claims a PDF named Bendigo or unnamed, and no other bank', async () => {
    const parser = new BendigoParser();
    expect(await parser.canParse(BankName.BENDIGO, FileType.PDF, 'x.pdf', STATEMENT)).toBe(true);
    expect(await parser.canParse(BankName.OTHER, FileType.PDF, 'x.pdf', STATEMENT)).toBe(true);
    expect(await parser.canParse(BankName.ANZ, FileType.PDF, 'x.pdf', STATEMENT)).toBe(false);
    expect(await parser.canParse(BankName.BENDIGO, FileType.CSV, 'x.csv', STATEMENT)).toBe(false);
  });

  it('types a line by how it starts', () => {
    expect(bendigoPaymentType('WITHDRAWAL - EFTPOS 1234 ACME CAFE CARD NUMBER 1')).toBe('card');
    expect(bendigoPaymentType('INTEREST')).toBe('interest');
    expect(bendigoPaymentType('Monthly Transaction Summary')).toBeNull();
  });

  it('names the payee without the terminal number and the card', () => {
    expect(
      bendigoPayee('WITHDRAWAL - EFTPOS 1234 ACME CAFE HARBOUR CARD NUMBER 500000XXXXXXX001 1'),
    ).toBe('ACME CAFE HARBOUR');
    expect(bendigoPayee('INTEREST')).toBe('');
  });

  it('leaves out zero-value lines and the monthly fee summary', () => {
    const rows = [
      row([[0, 'Date'], [1, 'Transaction'], [2, 'Withdrawals'], [3, 'Deposits'], [4, 'Balance']], 100),
      row([[0, '09 Mar 23'], [1, 'WITHDRAWAL - EFTPOS 1234 ACME CAFE'], [2, '2.00'], [4, '54.99']], 120),
      row([[0, '09 Mar 23'], [1, 'INTEREST'], [3, '0.00'], [4, '54.99']], 140),
      row([[0, '09 Mar 23'], [1, 'Monthly Transaction Summary'], [2, '4.20']], 160),
      row([[0, '09 Mar 23'], [1, 'INTEREST'], [3, '0.01'], [4, '55.00']], 180),
    ];
    const kept = new Probe().read(rows);
    expect(kept.map(r => [r.debit, r.credit])).toEqual([
      [2, undefined],
      [undefined, 0.01],
    ]);
  });
});
