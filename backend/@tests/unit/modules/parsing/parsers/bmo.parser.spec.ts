import type { PdfTextRow } from '@/common/utils/pdf-parser.util';
import { BankName, FileType } from '@/entities/statement.entity';
import {
  BmoParser,
  bmoPayee,
  bmoPaymentType,
  isBmoStatement,
} from '@/modules/parsing/parsers/bmo.parser';

const STATEMENT = [
  'BMO BANK N.A. P.O. BOX 94033',
  'ACCOUNT NUMBER: 0000000001',
  'DEPOSIT ACCOUNT SUMMARY',
].join('\n');

/** Columns: date 40, amount 170, description 215. */
const COLUMN_X = [40, 170, 215];

const row = (cells: Array<[number, string]>, y: number): PdfTextRow => ({
  text: cells.map(([, text]) => text).join(' '),
  y,
  page: 1,
  items: cells.map(([column, text]) => ({ text, x: COLUMN_X[column], width: 30 })),
});

class Probe extends BmoParser {
  read(rows: PdfTextRow[]) {
    return this.readTransactions(rows);
  }
}

describe('BmoParser', () => {
  it('knows its statement by the bank name and the account summary', () => {
    expect(isBmoStatement(STATEMENT)).toBe(true);
    expect(isBmoStatement('BMO BANK N.A. P.O. BOX 94033')).toBe(false);
    expect(isBmoStatement('DEPOSIT ACCOUNT SUMMARY')).toBe(false);
  });

  it('claims a PDF named BMO or unnamed, and no other bank', async () => {
    const parser = new BmoParser();
    expect(await parser.canParse(BankName.BMO, FileType.PDF, 'x.pdf', STATEMENT)).toBe(true);
    expect(await parser.canParse(BankName.OTHER, FileType.PDF, 'x.pdf', STATEMENT)).toBe(true);
    expect(await parser.canParse(BankName.ANZ, FileType.PDF, 'x.pdf', STATEMENT)).toBe(false);
    expect(await parser.canParse(BankName.BMO, FileType.CSV, 'x.csv', STATEMENT)).toBe(false);
  });

  it('types a line by how it starts', () => {
    expect(bmoPaymentType('ACH DEBIT PPD ACME UTILITY PAY')).toBe('direct_debit');
    expect(bmoPaymentType('PC TRANSFER CREDIT')).toBe('bank_transfer_in');
    expect(bmoPaymentType('PC TRANSFER DEBIT')).toBe('bank_transfer_out');
    expect(bmoPaymentType('ACCT ANALYSIS SERV CHG')).toBe('fee');
    expect(bmoPaymentType('TELLER DEPOSIT')).toBeNull();
  });

  it('names the payee without the entry class, and none for a bare transfer', () => {
    expect(bmoPayee('ACH DEBIT PPD ACME UTILITY PAY')).toBe('ACME UTILITY PAY');
    expect(bmoPayee('ACH DEBIT CCD ACME 000123 ACCT FEE')).toBe('ACME 000123 ACCT FEE');
    expect(bmoPayee('PC TRANSFER DEBIT')).toBe('');
    expect(bmoPayee('PC TRANSFER DEBIT DIGITAL BANKING CARD PAYMENT *0001')).toBe(
      'DIGITAL BANKING CARD PAYMENT *0001',
    );
    expect(bmoPayee('TELLER DEPOSIT')).toBe('');
  });

  it('describes a check by its serial and drops the legend printed under the table', () => {
    const rows = [
      row([[0, 'Date'], [1, 'Amount'], [2, 'Description']], 100),
      row([[0, 'Jun 18'], [1, '20.00'], [2, '4239']], 120),
      row([[0, 'Jun 17'], [1, '10.00'], [2, '4242']], 140),
      row([[2, '* Indicates break in check sequence']], 148),
    ];
    const kept = new Probe().read(rows);
    expect(kept.map(r => [r.description, r.counterparty])).toEqual([
      ['Check 4239', 'Check 4239'],
      ['Check 4242', 'Check 4242'],
    ]);
  });
});
