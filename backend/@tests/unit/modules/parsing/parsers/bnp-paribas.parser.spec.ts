import { BankName, FileType } from '@/entities/statement.entity';
import {
  BnpParibasParser,
  bnpParibasPaymentType,
  isBnpParibasStatement,
} from '@/modules/parsing/parsers/bnp-paribas.parser';

const STATEMENT = [
  'BNP Paribas Bank Polska S.A.',
  'Bank statement',
  'For month October 2021',
  'Statement number 10/2021/M',
].join('\n');

describe('BnpParibasParser', () => {
  it('knows its statement by the bank name and the statement number', () => {
    expect(isBnpParibasStatement(STATEMENT)).toBe(true);
    expect(isBnpParibasStatement('BNP Paribas Bank Polska S.A.')).toBe(false);
    expect(isBnpParibasStatement('Statement number 10/2021/M')).toBe(false);
    expect(isBnpParibasStatement('Transfer to BNP Paribas Fortis\nStatement number 1')).toBe(false);
  });

  it('claims a PDF named BNP Paribas or unnamed, and no other bank', async () => {
    const parser = new BnpParibasParser();
    expect(await parser.canParse(BankName.BNP_PARIBAS, FileType.PDF, 'x.pdf', STATEMENT)).toBe(true);
    expect(await parser.canParse(BankName.OTHER, FileType.PDF, 'x.pdf', STATEMENT)).toBe(true);
    expect(await parser.canParse(BankName.ANZ, FileType.PDF, 'x.pdf', STATEMENT)).toBe(false);
    expect(await parser.canParse(BankName.BNP_PARIBAS, FileType.CSV, 'x.csv', STATEMENT)).toBe(false);
  });

  it('types an operation by how it starts', () => {
    expect(bnpParibasPaymentType('ACCOUNT/PACKAGE MAINTENANCE FEE 0000-AAAAAA-001')).toBe('fee');
    expect(bnpParibasPaymentType('COMM-SEPA TRANSFER Charges of the bank')).toBe('fee');
    expect(bnpParibasPaymentType('TRANSFER VIA INTERNET 000')).toBeNull();
  });

  it('reads the month the statement is for as its period', () => {
    const range = (new BnpParibasParser() as unknown as {
      extractDateRange(text: string): { from: Date | null; to: Date | null };
    }).extractDateRange(STATEMENT);
    expect(range.from).toEqual(new Date(Date.UTC(2021, 9, 1)));
    expect(range.to).toEqual(new Date(Date.UTC(2021, 9, 31)));
  });
});
