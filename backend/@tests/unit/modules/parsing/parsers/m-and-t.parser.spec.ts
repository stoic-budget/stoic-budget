import { BankName, FileType } from '@/entities/statement.entity';
import type { ParsedTransaction } from '@/modules/parsing/interfaces/parsed-statement.interface';
import { MAndTParser, isMAndTStatement, mAndTEntry } from '@/modules/parsing/parsers/m-and-t.parser';

const STATEMENT = [
  'M&T Bank checking statement',
  'Deposits',
  'Manufacturers and Traders Trust Company, member FDIC',
].join('\n');

const row = (paymentPurpose: string, amount: { debit?: number; credit?: number }): ParsedTransaction => ({
  transactionDate: new Date(2022, 3, 5),
  paymentPurpose,
  counterpartyName: paymentPurpose,
  currency: 'USD',
  ...amount,
});

describe('MAndTParser', () => {
  it('knows its statement by the bank\'s name', () => {
    expect(isMAndTStatement(STATEMENT)).toBe(true);
    expect(isMAndTStatement('Deposits\nWithdrawals')).toBe(false);
  });

  it('parses its files under its own bank or OTHER, and PDFs only', async () => {
    const parser = new MAndTParser();
    const claims = (bank: BankName, type = FileType.PDF) =>
      parser.canParse(bank, type, 'x.pdf', STATEMENT);
    await expect(claims(BankName.M_AND_T)).resolves.toBe(true);
    await expect(claims(BankName.OTHER)).resolves.toBe(true);
    await expect(claims(BankName.KEYBANK)).resolves.toBe(false);
    await expect(claims(BankName.M_AND_T, FileType.CSV)).resolves.toBe(false);
  });

  it.each([
    ['ACH DEPOSIT, ACME PAYROLL 1000000001', { credit: 3408.35 }, 'bank_transfer_in'],
    ['DEPOSIT, ATM', { credit: 4022 }, 'cash'],
    ['MONTHLY SERVICE FEE', { debit: 25 }, 'fee'],
  ])('types %s', (purpose, amount, paymentType) => {
    expect(mAndTEntry(row(purpose, amount)).paymentType).toBe(paymentType);
  });
});
