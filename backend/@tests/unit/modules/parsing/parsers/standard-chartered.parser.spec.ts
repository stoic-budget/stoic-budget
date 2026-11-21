import { BankName, FileType } from '@/entities/statement.entity';
import type { ParsedTransaction } from '@/modules/parsing/interfaces/parsed-statement.interface';
import {
  StandardCharteredParser,
  isStandardCharteredStatement,
  standardCharteredEntry,
} from '@/modules/parsing/parsers/standard-chartered.parser';

const STATEMENT = ['Statement of Account', 'Account Name MEMBER ONE', 'Account Currency BND', 'Apply for the Standard Chartered card'].join(
  '\n',
);

const row = (paymentPurpose: string, amount: { debit?: number; credit?: number }): ParsedTransaction => ({
  transactionDate: new Date(2022, 7, 15),
  paymentPurpose,
  counterpartyName: paymentPurpose,
  currency: 'BND',
  ...amount,
});

describe('StandardCharteredParser', () => {
  it('knows its statement by its name and account details', () => {
    expect(isStandardCharteredStatement(STATEMENT)).toBe(true);
    expect(isStandardCharteredStatement('Transfer to Standard Chartered')).toBe(false);
  });

  it('parses its files under its own bank or OTHER, and PDFs only', async () => {
    const parser = new StandardCharteredParser();
    const claims = (bank: BankName, type = FileType.PDF) =>
      parser.canParse(bank, type, 'x.pdf', STATEMENT);
    await expect(claims(BankName.STANDARD_CHARTERED)).resolves.toBe(true);
    await expect(claims(BankName.OTHER)).resolves.toBe(true);
    await expect(claims(BankName.HSBC)).resolves.toBe(false);
    await expect(claims(BankName.STANDARD_CHARTERED, FileType.CSV)).resolves.toBe(false);
  });

  it.each([
    ['ATM WDR AT 2010 08:28:09', { debit: 460 }, 'ATM WDR AT 2010 08:28:09', 'cash'],
    ['POS PRCSE ACME TRADING SDN BHD 5995 SAMP BN', { debit: 82.6 }, 'ACME TRADING SDN BHD', 'card'],
    ['SALARY PAYMENT', { credit: 1119 }, 'SALARY PAYMENT', 'bank_transfer_in'],
  ])('reads %s', (purpose, amount, payee, paymentType) => {
    expect(standardCharteredEntry(row(purpose, amount))).toMatchObject({ counterpartyName: payee, paymentType });
  });
});
